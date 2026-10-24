# Extraction benchmark

Measures how many of an RFP's real requirements DraftBid AI's extraction finds, using public RFPs and hand-built answer lists ("gold" lists).

## Adding an RFP

1. Put the public RFP (PDF, Word, Excel or a scan) in `benchmark/rfps/`.
2. Write its gold list as `benchmark/gold/<name>.json`:

```json
{
  "rfp": "city-of-example-managed-it.pdf",
  "segment": "it-services",
  "sector": "public",
  "source": "https://… (where the public RFP was published)",
  "requirements": [
    { "text": "Proposals due 20 November 2026 at 2:00 PM Eastern", "mandatory": true },
    { "text": "Maximum 20 pages excluding appendices", "mandatory": true },
    { "text": "Experience with municipal clients", "mandatory": false }
  ]
}
```

- **One requirement per item,** in the RFP's own words where possible. Include any exact figures (amounts, page counts, dates), because numbers must match exactly.
- **`mandatory: true`** for anything that disqualifies a bid if it is missed: pass/fail criteria, required forms and certificates, deadlines, page limits, required questions.
- **`segment`:** use a slug from `lib/segments.ts` (`it-services`, `consultancies`, `service-contractors`), or any tag you want broken out in the report.
- **`sector`:** `public` or `commercial`.

Files whose names start with `example` are ignored.

## Running

```bash
OPENAI_API_KEY=… npm run benchmark                   # all gold files
OPENAI_API_KEY=… npm run benchmark -- --only=city    # gold files whose name contains "city"
```

Each RFP costs about one extraction, plus OCR for scans. The report goes to `benchmark/results/<date>.md`, with:

- overall mandatory recall, recall and precision;
- average time, average cost and p95 cost;
- breakdowns by segment and by sector;
- a per-RFP table, and every mandatory requirement that was missed.

## How it is scored

`scripts/benchmark/score.ts` does the scoring, and it is unit-tested.

- **Matching:** a gold requirement counts as found when an extracted item contains at least 60% of its meaningful words and **every number** in it. Each extracted item can match only one gold item.
- **What counts as extracted:** mandatory, desirable, evaluation and submission requirements, questions, key details and the deadline.
- **Recall** is pooled over all requirements, not averaged per RFP.
- **Precision is a lower bound:** anything extracted that the gold list doesn't contain counts as wrong.
- **Launch target:** mandatory recall of at least 85% across 20 RFPs spread over the segments, both public-sector and commercial. The report says plainly whether the target was met.
