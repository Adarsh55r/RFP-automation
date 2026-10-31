"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FileUp, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAlert } from "@/components/ui/sweet-alert";
import { groupKeyDetails, type KeyDetail } from "@/lib/key-details";

type Checklist = {
  documentType: string;
  scope: string;
  deadline: string | null;
  mandatory: string[];
  desirable: string[];
  evaluation: string[];
  submission: string[];
  questions: string[];
  questionCount: number;
  keyDetails: KeyDetail[];
  flags: string[];
};

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="font-sans text-base font-semibold text-ink">
        {title} <span className="font-mono text-xs text-slate">({items.length})</span>
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** Upload one RFP and see its requirement checklist, without an account. */
export function FreeChecklistTool() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const alert = useAlert();
  const [result, setResult] = useState<Checklist | null>(null);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [leadState, setLeadState] = useState<"idle" | "sent" | "error">("idle");

  const run = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/tools/checklist", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as (Checklist & { error?: string }) | null;
      if (!response.ok || !payload || payload.error) throw new Error(payload?.error ?? "The checklist could not be built.");
      setResult(payload);
    } catch (runError) {
      alert.error("Couldn't build the checklist", runError instanceof Error ? runError.message : "The checklist could not be built.");
    } finally {
      setBusy(false);
    }
  };

  const sendLead = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/tools/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, consent }),
    });
    setLeadState(response.ok ? "sent" : "error");
  };

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col items-start gap-4">
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void run(file);
          }}
        />
        <Button type="button" size="lg" variant="accent" disabled={busy} onClick={() => input.current?.click()} className="gap-2">
          {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <FileUp className="size-5" aria-hidden />}
          {busy ? "Reading your RFP… (up to a minute)" : "Choose an RFP (PDF or Word)"}
        </Button>
        <p className="text-sm leading-relaxed text-slate">
          Up to 4 MB and 80 pages. Your file is read once to build the checklist and is <strong>not stored</strong>: not
          in our storage, our database or our logs. It is sent to our AI provider to read it (see{" "}
          <Link href="/subprocessors" className="text-brand underline-offset-2 hover:underline">
            subprocessors
          </Link>
          ). To apply the daily limit we keep a one-way hash of your IP address for 30 days.
        </p>
      </Card>

      {result ? (
        <Card className="flex flex-col gap-6" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Your requirement checklist</h2>
              <p className="mt-1 text-sm text-slate">
                Check it against the document: extraction can miss or misread items.
              </p>
            </div>
            {result.deadline ? <Badge variant="danger">Due {result.deadline}</Badge> : null}
          </div>
          {result.scope ? <p className="text-sm leading-relaxed text-ink">{result.scope}</p> : null}
          <List title="Mandatory requirements" items={result.mandatory} />
          <List title="Evaluation criteria" items={result.evaluation} />
          <List title="Submission requirements" items={result.submission} />
          <List title="Desirable" items={result.desirable} />
          {result.questionCount > 0 ? (
            <List
              title={`Questions to answer${result.questionCount > result.questions.length ? ` (first ${result.questions.length} of ${result.questionCount})` : ""}`}
              items={result.questions}
            />
          ) : null}
          {groupKeyDetails(result.keyDetails).map((group) => (
            <List
              key={group.category}
              title={group.label}
              items={group.items.map((item) => `${item.detail}${item.page ? ` (p. ${item.page})` : ""}${item.verified ? "" : " [check]"}`)}
            />
          ))}
          <List title="Worth checking" items={result.flags} />

          <div className="flex flex-col gap-4 rounded-control border border-brand/30 bg-brand/5 p-5">
            <h3 className="font-display text-lg font-semibold text-ink">Get a first draft of the response</h3>
            <p className="text-sm text-slate">
              Create a free account, add your past proposals and case studies, and DraftBid AI drafts the response from them,
              flagging anything they don&apos;t support.
            </p>
            <Button asChild variant="accent" className="w-fit">
              <Link href="/sign-up?plan=free&seg=checklist-tool">Draft your first proposal free</Link>
            </Button>
            {leadState === "sent" ? (
              <p role="status" className="text-sm text-success">
                Thanks. We&apos;ll be in touch.
              </p>
            ) : (
              <form onSubmit={sendLead} className="flex flex-col gap-3">
                <p className="text-sm text-slate">Not ready yet? Leave your email and we&apos;ll follow up once.</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label htmlFor="lead-email" className="sr-only">
                    Email
                  </label>
                  <Input id="lead-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
                  <Button type="submit" variant="secondary" disabled={!consent} className="sm:w-fit">
                    Send
                  </Button>
                </div>
                <label className="flex items-start gap-2 text-xs text-slate">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5" />
                  I agree that DraftBid AI may email me about this checklist and the product. I can ask for my email to be
                  deleted at any time (see the privacy policy).
                </label>
                {leadState === "error" ? <p className="text-sm text-danger">That did not work. Check the address and try again.</p> : null}
              </form>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
