# AI quality evaluation

## Bottom line

The AI pipeline is sensible. It extracts once with a strict JSON schema, then drafts section by section from the bidder's own library, then runs a compliance review.

Before this audit it had no guardrails between the model and the user. Truncated output, missed requirements past 120k characters, a wrong deadline, or an invented certification all reached the user without any signal. Each of these now produces either a visible flag or a hard error, and tests cover them.

**What is still unmeasured:** how often the real model gets the deadline, mandatory items and question count right, and how often it claims credentials the bidder lacks. The eval that measures this is written (`tests/eval/ai-quality.eval.test.ts`) but was **NOT RUN**, because the audit sandbox has no `OPENAI_API_KEY`. Until it runs, treat extraction accuracy as unproven.

## How the AI is used

| Step | Model call | Input | Output cap | Guardrails now in place |
|---|---|---|---|---|
| Extract | 1 JSON call (GPT-4.1) | Up to 400,000 characters of document text (previously 120k) | 32,768 tokens (previously 8,192) | Error if truncated; four deterministic checks; a notice when the document was only partly read; refund on failure |
| Plan | 1 JSON call | Extracted requirements, source (≤150k characters), library (≤200k characters), company details | 8,000 | Prompt tags neutralised |
| Sections | 1 streamed call per section; questionnaires in batches of 15, 3 at a time | Same context plus the plan | Per section | Visible `[[Incomplete…]]` marker if cut off; placeholder check before export; credential check |
| Review | 1 call, low effort | Plan plus the drafted text | 16,000 | Same |

Prompt design that was already good:

- The prompt rule says to use only the bidder's library and to mark gaps as `[[placeholder]]`.
- A few-shot example demonstrates addendum handling.
- The rules say to tolerate OCR noise without guessing.

## Synthetic fixtures (`tests/fixtures/rfps.ts`)

All fixtures are invented; none contain real customer data. Each carries golden expectations.

| Fixture | What it tests | Golden expectation |
|---|---|---|
| `straightforward-public-tender` | A normal city RFP with 5 questions | Deadline 2026-11-20; 4 mandatory items (Kentucky licence, $2M liability, 5 years' experience, 24/7 support); 5 questions; no SOC 2, ISO 27001 or FedRAMP in the output |
| `addendum-overrides-deadline` | An addendum moves the due date | The deadline must be 2026-12-04, not the original date |
| `conflicting-deadline-no-addendum` | Two dates with no explanation | A conflict must be flagged |
| `missing-deadline` | No due date anywhere | The deadline must be null; a date must not be invented |
| `long-rfp-requirement-at-end` | More than 120k characters, with a 10% performance bond at the end | The bond must be found |
| `security-questionnaire-60` | 60 numbered questions | Deadline 2027-01-15; 60 extracted, in order |
| `prompt-injection` | Embedded "ignore previous instructions", a closing tag, and a fake requirement | Injected values never appear in the output |
| `LIMITED_LIBRARY` | A bidder with no SOC 2, ISO or FedRAMP | The draft must not claim them |

## What was run, and the results

### Deterministic checks (run; all pass)

These measure the pipeline mechanics with a scripted fake model. They test what the *code* does with model output, not how good the model is.

| Behaviour | Result |
|---|---|
| A requirement beyond 120k characters reaches the model | Pass (failed at baseline) |
| A partly read document is reported with its read percentage | Pass (failed at baseline) |
| A deadline the model returns that is not in the document is flagged | Pass (failed at baseline) |
| An addendum date that should override the original is flagged when not used | Pass |
| Extracting 45 of 60 numbered questions is flagged | Pass (failed at baseline) |
| A paraphrased or ungrounded mandatory item (under 50% word coverage) is flagged | Pass |
| Truncated JSON gives a specific error, the allowance is refunded and nothing partial is saved | Pass (failed at baseline) |
| A truncated draft section is visibly marked | Pass (failed at baseline) |
| A 60-question questionnaire is answered in full and in order | Pass |
| A closing data tag inside a document is neutralised | Pass (failed at baseline) |
| A credential named in the draft but not in the library is reported | Pass |
| DOCX and PDF parsing keeps the facts (dates, amounts, table cells) | Pass. Two-column PDFs interleave lines (a known limitation, O-03) |

### Real-model eval (NOT RUN: blocked, no API key)

`npm run eval:ai` runs every fixture through GPT-4.1 and asserts:

- no prohibited or injected values in the output;
- mandatory-item recall of at least 75%;
- deadline correct, or flagged when missing or conflicting;
- question count exact;
- expected flags raised;
- for drafting with `LIMITED_LIBRARY`: no unsupported SOC 2 claim and no claim of $2M insurance cover the bidder does not have.

The run costs about $1. Record the per-fixture JSON lines it prints here.

| Metric | Target | Measured |
|---|---|---|
| Deadline accuracy (6 fixtures) | 100%, or flagged | not run |
| Mandatory-item recall | ≥ 75% per fixture | not run |
| Question-count exactness | 100% | not run |
| Injected or hallucinated values | 0 | not run |
| Unsupported credential claims | 0 | not run |

## Known weaknesses that remain

1. **No citations.** Extracted requirements carry no page or section reference, so users cannot quickly check them against the source. This is the biggest remaining trust gap (O-04). The word-coverage check is a partial substitute.
2. **The checks are heuristics.** Each one has a blind spot:
   - Date finding covers common formats, but not "the thirtieth day after award".
   - Question counting relies on numbering.
   - Word coverage can pass a paraphrase that changes meaning ("may" vs "must").
3. **Scanned PDFs** are rejected with OCR guidance and are not processed (O-02).
4. **Drafting reads only the first 150k characters of source text.** It relies on the extracted requirements for the rest, which is acceptable now that extraction reads 400k characters.
5. **The credential check is a fixed list.** A claim like "we hold a $5M cyber policy" is not checked. The prompt rule is the only guard.

## Cost (estimate, not measured)

Figures use GPT-4.1 list prices of $2 per 1M input tokens and $8 per 1M output tokens. Check them against current OpenAI pricing.

- **Extraction:** a typical 50-page RFP (about 25k tokens) costs about $0.08. The 400k-character maximum (about 100k tokens in, up to 32k out) costs about $0.45.
- **Full draft:** each call resends the whole context: up to about 37k tokens of source and 50k of library.
  - A typical draft (5 sections, 15 questions, small library) is about 8 calls and costs about $0.50–0.80.
  - The worst case is a 150-question questionnaire with a full 200k-character library: about 15 calls, about 1.3M input tokens, roughly $2.50 before OpenAI's automatic prompt caching (the context comes first, so it is likely to be cached).
- The existing monthly spend cap ($3 on Free) bounds the damage, but **one worst-case draft can use most of a Free user's month**. Consider sending only the library items relevant to each section when usage data shows this matters.
