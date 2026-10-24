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

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const value = ipv4ToInt(address);
    return IPV4_BLOCKS.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      /^f[cd]/.test(lower) || // unique local fc00::/7
      /^fe[89ab]/.test(lower) || // link-local fe80::/10
      /^ff/.test(lower) || // multicast
      /^2001:db8:/.test(lower) ||
      /^64:ff9b:/.test(lower) // NAT64, can reach IPv4 space
    );
  }
  return true;
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
