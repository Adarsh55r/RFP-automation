import { AI_NO_TRAINING_CONFIRMED } from "@/lib/company";

/**
 * Pricing-page FAQs. Also published as structured data and in /llms.txt, so
 * search engines and AI assistants quote the same answers customers read.
 * Every answer must match the plans in lib/plans.ts and what the product does.
 */
export const faqs: { question: string; answer: string }[] = [
  {
    question: "How is DraftBid AI different from ChatGPT?",
    answer:
      "ChatGPT and similar assistants can help with an RFP if you paste the right parts in and check everything yourself. DraftBid AI is built for the whole response: it reads the full document, lists the requirements, deadlines, page limits and evaluation criteria it finds as a checklist you confirm, checks the deadline and question count against the document itself, drafts every section from the content library you saved, marks anything it cannot support as a gap for you to fill, flags certifications your library does not mention, runs a compliance review, and exports a formatted Word or PDF file. Your library is reused on every bid, so you are not pasting the same material each time.",
  },
  {
    question: "How is DraftBid AI different from DeepRFP or Pelican Bid?",
    answer:
      "They are also AI tools for answering RFPs, and their features and prices change, so compare them directly on the same RFP. DraftBid AI focuses on three things: a requirements checklist you confirm before drafting, drafts written only from your own documents with gaps highlighted instead of guessed, and plans that show exactly how many proposals they include, with a free trial and a single-bid pass if you only need one response.",
  },
  {
    question: "Will the AI make things up?",
    answer:
      "It is built not to, and it shows its working. DraftBid AI writes only from the RFP and your own library (case studies, bios, certifications, saved answers), and each statement about your company is marked with the library passage it came from, which you can click to read. Statements about your company with no supporting passage are listed for you to check, and any marker that does not match your library is removed. When a fact is missing, such as a price, a reference contact or an insurance limit, it leaves a highlighted placeholder instead of inventing one. A compliance review shows which requirements are covered and which still need you. You can export an internal review copy with the sources listed, and a clean copy for submission. Always review a draft before you submit it.",
  },
  {
    question: "What counts as a proposal?",
    answer:
      "Each RFP you upload is one proposal. It includes extracting its requirements and drafting and revising the response, within the per-proposal allowances shown in the app. Deleting an RFP does not give the proposal back.",
  },
  {
    question: "What happens when I reach my plan's limit?",
    answer:
      "On Starter and Pro you can keep going: before an extra proposal starts, DraftBid AI shows its price ($29 on Starter, $25 on Pro) and only continues if you confirm. The free trial and the single-bid pass include one proposal; after that you choose a plan. Nothing you have already created is deleted, and finished proposals stay downloadable.",
  },
  {
    question: "What is the single-bid pass?",
    answer:
      "A one-time $149 payment for one proposal, with 30 days of access. If you subscribe to a plan within 30 days of buying it, the $149 is credited to your first invoice.",
  },
  {
    question: "How do I pay, and can I cancel?",
    answer:
      "Online checkout is not open yet; until it is, we set up paid plans with you directly from the billing page. Monthly plans can be cancelled at any time and stop at the end of the month you paid for. Annual plans are paid for the year; you can turn off renewal and keep access until the year ends. Prices are in US dollars, and invoices will show VAT or sales tax where it applies.",
  },
  {
    question: "Can I change plans?",
    answer:
      "Yes. Upgrades apply straight away. Downgrades apply from your next renewal, so you keep the limits you have paid for until then.",
  },
  {
    question: "What is the done-with-you setup?",
    answer:
      "For $500 one-time, we load your past proposals, case studies, résumés and certifications into your library and run your first bid with you, so your first draft starts from strong material. It is included free with Pro on annual billing.",
  },
  {
    question: "How long does a first draft take?",
    answer:
      "Drafting runs while you watch, section by section; a long questionnaire takes longer than a short RFP. Then you review it, fill the highlighted gaps and export, instead of writing every section from a blank page.",
  },
  {
    question: "Which files can I upload?",
    answer:
      "PDF and Word (.docx) files up to 25 MB. Scanned PDFs need searchable text (OCR) first, and Excel questionnaires are not supported yet; both are on our roadmap. If an RFP has addenda, include them in the same file.",
  },
  {
    question: "Does it work for public-sector bids?",
    answer:
      "Yes. DraftBid AI handles US state, local and education (SLED) RFPs and UK public-sector tenders, including councils, NHS trusts, universities, Find a Tender and Contracts Finder notices, alongside commercial RFPs and security questionnaires. It drafts and checks your response; it does not log into procurement portals, file bid bonds, or act as a FAR/DFARS compliance tool for US federal contracts.",
  },
  {
    question: "Is my data secure?",
    answer: `RFP files, library items and drafts are private to your account, and every request is checked against it. ${
      AI_NO_TRAINING_CONFIRMED
        ? "Neither we nor our AI provider train models on your documents."
        : "We do not train models on your documents."
    } You can delete an RFP or your whole workspace yourself at any time. Details are on our security and subprocessors pages.`,
  },
];
