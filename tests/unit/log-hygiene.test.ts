import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubEvent } from "@/lib/monitoring";
import { MAX_LOGGED_MESSAGE, safeErrorSummary } from "@/lib/safe-log";

const SECRET = "CONFIDENTIAL-RFP-TEXT ".repeat(200);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (entry === "generated" || entry === "node_modules") return [];
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

describe("logs and error reports never carry document content", () => {
  it("server log summaries keep the error type and code locations, not long quoted input", () => {
    const error = new Error(`Invalid prisma.rfp.update() invocation: data: { sourceText: "${SECRET}" }`);
    const summary = safeErrorSummary(error);
    expect(summary.length).toBeLessThan(MAX_LOGGED_MESSAGE + 1000);
    expect(summary.split("CONFIDENTIAL").length - 1).toBeLessThan(20);
    expect(summary).toContain("Error: Invalid prisma.rfp.update()");
    expect(summary).toMatch(/\n\s+at /);
  });

  it("error reports drop request bodies, cookies, extra data and long messages", () => {
    const event = {
      request: { data: SECRET, cookies: { session: "token" }, url: "https://draftbidai.com/api/rfps/x/draft" },
      exception: { values: [{ type: "Error", value: SECRET }] },
      extra: { document: SECRET },
    } as unknown as ErrorEvent;
    const scrubbed = scrubEvent(event);
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.exception!.values![0].value!.length).toBeLessThan(MAX_LOGGED_MESSAGE + 20);
  });

  it("console output never becomes a breadcrumb, and network breadcrumbs keep only method, URL and status", () => {
    expect(scrubBreadcrumb({ category: "console", message: SECRET })).toBeNull();
    const fetchCrumb = scrubBreadcrumb({ category: "fetch", data: { method: "POST", url: "/api/x", status_code: 500, body: SECRET } });
    expect(fetchCrumb?.data).toEqual({ method: "POST", url: "/api/x", status_code: 500 });
  });

  it("every server-side error log goes through the content-safe summary", () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles("app"), ...sourceFiles("lib"), "instrumentation.ts"]) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (/console\.(error|warn|log|info)\(/.test(line) && /,\s*\w*[eE]rror\)/.test(line) && !line.includes("safeErrorSummary")) {
          offenders.push(`${file}:${index + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
