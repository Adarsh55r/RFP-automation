/**
 * Pricing-page FAQs. Also published as structured data and in /llms.txt, so
 * search engines and AI assistants quote the same answers customers read.
 */
export const faqs: { question: string; answer: string }[] = [
  {
    question: "Will the AI make things up?",
    answer:
      "It is built not to. DraftBid AI writes only from the RFP and your own library (case studies, bios, certifications, saved answers). When a fact is missing, such as a price, a reference contact, or an insurance limit, it leaves a highlighted placeholder for you to fill instead of inventing one. It also flags any certification a draft names that your library does not mention, and a compliance review shows which requirements are covered and which still need you. Always review a draft before you submit it.",
  },
  {
    question: "How long does a first draft take?",
    answer:
      "Usually one to three minutes after you confirm the requirements. Then you review it, fill the highlighted gaps, and export — instead of writing every section from a blank page.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Monthly plans stop at the end of the current billing month. Annual plans are prepaid for the year; you can cancel renewal and keep access until that year runs out. We do not lock you into a multi-year contract.",
  },
  {
    question: "What happens if I go over my RFP limit?",
    answer:
      "New drafts pause once you hit the monthly proposal cap. Finished proposals stay downloadable. Upgrade in place — Growth and Team lift the cap immediately — or wait until the next billing month. We will not silently delete work.",
  },
  {
    question: "Which currencies and invoices do you support?",
    answer:
      "Plans are priced in US dollars and British pounds. Paid plans are billed by card, with an itemised invoice sent to the billing email on the account. UK and EU businesses can add a VAT number for reverse-charge invoices; US sales tax is added only where it applies.",
  },
  {
    question: "Is my data secure?",
    answer:
      "RFP files, library items, and drafts are private to your workspace. Neither we nor our AI providers train models on your documents. Email us to export or delete your workspace; deletion removes source files and generated drafts from our systems.",
  },
  {
    question: "Can I switch plans mid-cycle?",
    answer:
      "Upgrades take effect immediately and we charge the difference for the rest of the cycle. Downgrades apply at the next renewal so you keep the higher limits you already paid for.",
  },
  {
    question: "Does it work for public-sector bids?",
    answer:
      "Yes. DraftBid AI handles US state, local, and education (SLED) RFPs and UK public-sector tenders — councils, NHS trusts, universities, Find a Tender and Contracts Finder notices — alongside commercial RFPs and security questionnaires. It drafts and checks your response; it does not log into procurement portals, file bid bonds, or act as a FAR/DFARS compliance tool for US federal contracts.",
  },
  {
    question: "How is this different from Loopio or Responsive?",
    answer:
      "Those are built for enterprise proposal teams and are typically sold on annual contracts priced in the tens of thousands. DraftBid AI is for small teams without a bid manager: upload the RFP, check the compliance checklist, draft from your own library, export to Word. Month-to-month, from $0.",
  },
];
