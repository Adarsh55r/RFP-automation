import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Fetches a public web page for a user-requested import, refusing anything
 * that could reach private infrastructure (SSRF): only http(s) on the default
 * ports, and every connection, including after redirects, is checked against
 * private, loopback, link-local and cloud-metadata addresses at the moment it
 * connects, so a DNS answer that changes between check and use is still caught.
 */

export class UnsafeUrlError extends Error {}

const IPV4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

/**
 * The eight 16-bit groups of an IPv6 address, from any valid spelling: "::"
 * shorthand, a trailing dotted IPv4 part or a zone suffix ("fe80::1%eth0").
 */
function ipv6Groups(address: string): number[] | null {
  let text = address.split("%")[0].toLowerCase();
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    if (!net.isIPv4(dotted[1])) return null;
    const value = ipv4ToInt(dotted[1]);
    text = `${text.slice(0, -dotted[1].length)}${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array<string>(fill).fill("0"), ...tail].map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  return groups.length === 8 && groups.every((group) => !Number.isNaN(group)) ? groups : null;
}

function ipv4FromGroups(high: number, low: number) {
  return [high >>> 8, high & 0xff, low >>> 8, low & 0xff].join(".");
}

/**
 * Whether an address must not be fetched. Reads IPv6 addresses as numbers, not
 * text, so an IPv4 address dressed as IPv6 (::ffff:7f00:1, ::127.0.0.1,
 * 0:0:0:0:0:ffff:a9fe:a9fe) is judged as the IPv4 address it reaches. Only
 * global unicast IPv6 (2000::/3) outside the special-use ranges is public.
 */
export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const value = ipv4ToInt(address);
    return IPV4_BLOCKS.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (!net.isIPv6(address)) return true;
  const groups = ipv6Groups(address);
  if (!groups) return true;
  const [a, b, c, d, e, f, g, h] = groups;
  // IPv4-mapped ::ffff:0:0/96, IPv4-translated ::ffff:0:0:0/96 and the
  // deprecated IPv4-compatible ::/96 (which also covers :: and ::1).
  if (a === 0 && b === 0 && c === 0 && d === 0) {
    if ((e === 0 && f === 0xffff) || (e === 0xffff && f === 0) || (e === 0 && f === 0)) {
      return isPrivateAddress(ipv4FromGroups(g, h));
    }
    return true;
  }
  if (a >>> 13 !== 0b001) return true; // outside global unicast 2000::/3: ULA, link-local, multicast, NAT64 64:ff9b::/96 …
  if (a === 0x2002) return isPrivateAddress(ipv4FromGroups(b, c)); // 6to4 carries an IPv4 address
  if (a === 0x2001 && b === 0) return true; // Teredo tunnels to an IPv4 address it hides
  if (a === 0x2001 && b === 0x0db8) return true; // documentation
  if (a === 0x2001 && b >>> 4 === 0x001) return true; // ORCHID 2001:10::/28
  if (a === 0x2001 && b >>> 4 === 0x002) return true; // ORCHIDv2 2001:20::/28
  return false;
}

/** Validates a URL before fetching: scheme, port, no credentials, no IP literals in private ranges. */
export function checkPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That is not a valid web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http and https addresses can be imported.");
  if (url.username || url.password) throw new UnsafeUrlError("Addresses with a username or password are not allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("Only standard web ports are allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUrlError("That address is not a public website.");
  }
  if (net.isIP(host) && isPrivateAddress(host)) throw new UnsafeUrlError("That address is not a public website.");
  return url;
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/** DNS lookup that refuses private answers; used by the HTTP client at connect time. */
function publicLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "");
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((entry) => isPrivateAddress(entry.address))) {
      return callback(Object.assign(new Error("Refusing to connect to a private address."), { code: "EPRIVATE" }), "");
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

export type FetchedPage = { url: string; status: number; contentType: string; body: string };

function requestOnce(url: URL, maxBytes: number, timeoutMs: number) {
  return new Promise<{ status: number; location: string | null; contentType: string; body: string }>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(
      url,
      {
        lookup: publicLookup as unknown as typeof dns.lookup,
        timeout: timeoutMs,
        headers: {
          "User-Agent": "DraftBidAI-Importer/1.0 (+https://draftbidai.com; user-requested import of their own website)",
          Accept: "text/html,text/plain;q=0.9",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentType = String(response.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          response.resume();
          resolve({ status, location: response.headers.location ?? null, contentType, body: "" });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            request.destroy();
            resolve({ status, location: null, contentType, body: Buffer.concat(chunks).toString("utf8") });
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ status, location: null, contentType, body: Buffer.concat(chunks).toString("utf8") }));
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("The website took too long to respond.")));
    request.on("error", reject);
  });
}

export async function safeFetchText(
  raw: string,
  { maxBytes = 2 * 1024 * 1024, timeoutMs = 10_000, maxRedirects = 3 } = {},
): Promise<FetchedPage> {
  let url = checkPublicUrl(raw);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const result = await requestOnce(url, maxBytes, timeoutMs);
    if (result.location && result.status >= 300 && result.status < 400) {
      url = checkPublicUrl(new URL(result.location, url).toString());
      continue;
    }
    return { url: url.toString(), status: result.status, contentType: result.contentType, body: result.body };
  }
  throw new UnsafeUrlError("The website redirected too many times.");
}
