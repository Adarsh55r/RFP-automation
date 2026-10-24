import { COMPANY } from "@/lib/company";
import { DPA_VERSION } from "@/lib/legal";

// DRAFT: must be reviewed by a lawyer in the company's jurisdiction before use. See docs/legal/README.md.

export type DpaClause = { title: string; paragraphs: string[] };

/** The Data Processing Addendum template, used by the /dpa page and the downloadable Word file. */
export function dpaClauses(): DpaClause[] {
  return [
    {
      title: "1. Parties and scope",
      paragraphs: [
        `This Data Processing Addendum ("DPA") forms part of the agreement between the customer named in the signature block ("Customer") and ${COMPANY.productName} ("Processor") for the ${COMPANY.productName} service (the "Agreement").`,
        "It applies where the Processor processes personal data on the Customer's behalf in providing the service, and the UK GDPR, the EU GDPR, or similar data protection law applies.",
      ],
    },
    {
      title: "2. Roles and instructions",
      paragraphs: [
        "The Customer is the controller and the Processor is the processor of Customer personal data. The Processor will process it only on the Customer's documented instructions, which are the Agreement, this DPA and the Customer's use of the service, unless the law requires otherwise, in which case the Processor will tell the Customer first where the law allows.",
      ],
    },
    {
      title: "3. Details of the processing",
      paragraphs: [
        "Subject matter and purpose: hosting uploaded requests for proposals and company content, extracting requirements, generating draft proposal text, and exporting documents.",
        "Duration: for the term of the Agreement and until deletion under section 9.",
        "Types of personal data: names, job titles, business contact details, résumés and professional histories, and any other personal data the Customer includes in uploaded documents or library content; account data of the Customer's users.",
        "Data subjects: the Customer's staff and users; contacts at buyers and references named in documents; other individuals named in documents the Customer uploads.",
        "Special category data: not intended. The Customer will not upload it unless it has a lawful basis and has told the Processor in writing.",
      ],
    },
    {
      title: "4. Confidentiality and security",
      paragraphs: [
        "The Processor ensures that people authorised to process Customer personal data are bound by confidentiality, and maintains the technical and organisational measures in Annex 2.",
      ],
    },
    {
      title: "5. Subprocessors",
      paragraphs: [
        "The Customer gives general authorisation for the Processor to use the subprocessors listed at https://draftbidai.com/subprocessors. The Processor will notify the Customer by email before a new subprocessor starts processing Customer personal data. The Customer may object on reasonable data protection grounds; if the parties cannot resolve the objection, the Customer may terminate the affected service and receive a refund of prepaid fees for the unused period.",
        "The Processor imposes data protection obligations on each subprocessor that are no less protective than this DPA and remains responsible for their performance.",
      ],
    },
    {
      title: "6. Assistance",
      paragraphs: [
        "Taking into account the nature of the processing, the Processor will help the Customer respond to requests from data subjects and meet its obligations on security, breach notification, data protection impact assessments and prior consultation.",
      ],
    },
    {
      title: "7. Personal data breaches",
      paragraphs: [
        "The Processor will notify the Customer without undue delay after becoming aware of a personal data breach affecting Customer personal data, with the information the Customer reasonably needs to meet its own obligations.",
      ],
    },
    {
      title: "8. International transfers",
      paragraphs: [
        "Where Customer personal data is transferred outside the UK or the EEA to a country without an adequacy decision, the parties rely on the EU Standard Contractual Clauses (Commission Decision 2021/914, Module 2 or 3 as applicable) and the UK International Data Transfer Addendum, which are incorporated by reference, or on another valid transfer mechanism.",
      ],
    },
    {
      title: "9. Deletion and return",
      paragraphs: [
        "The Customer can export its proposals and delete its data in the service at any time. At the end of the Agreement the Processor will delete Customer personal data from live systems within a reasonable time, and backups will be overwritten on the database provider's normal backup cycle, unless the law requires it to be kept.",
      ],
    },
    {
      title: "10. Audits",
      paragraphs: [
        "The Processor will make available the information reasonably necessary to demonstrate compliance with this DPA, and will allow audits by the Customer or its appointed auditor no more than once a year, on at least 30 days' notice, during business hours and subject to confidentiality.",
      ],
    },
    {
      title: "11. Liability and precedence",
      paragraphs: [
        "Each party's liability under this DPA is subject to the limitations in the Agreement. If this DPA conflicts with the Agreement on data protection, this DPA prevails.",
      ],
    },
    {
      title: "Annex 2: Technical and organisational measures",
      paragraphs: [
        "Encryption of data in transit (HTTPS with HSTS) and at rest by the database and storage providers.",
        "Server-side separation of each customer's data, checked by automated tests; private file storage with short-lived signed links.",
        "Access to production systems limited to named staff; admin access restricted to verified staff accounts.",
        "Upload validation by file content; text extraction only, with no execution of macros or embedded content.",
        "Error reports exclude request bodies, cookies and document content.",
        "Deletion of individual RFPs and of the whole workspace available to the Customer at any time.",
      ],
    },
    {
      title: "Signatures",
      paragraphs: [
        "Customer (company name): ____________________. Name, title, date, signature: ____________________",
        `Processor: ${COMPANY.productName}. Name, title, date, signature: ____________________`,
        `Template version ${DPA_VERSION}.`,
      ],
    },
  ];
}
