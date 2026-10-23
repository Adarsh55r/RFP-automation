import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { COMPANY } from "@/lib/company";
import { dpaClauses } from "@/lib/dpa";
import { DPA_VERSION } from "@/lib/legal";

export const dynamic = "force-static";

/** The DPA template as an editable Word document. */
export async function GET() {
  const doc = new Document({
    creator: COMPANY.productName,
    title: `${COMPANY.productName} Data Processing Addendum`,
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(`${COMPANY.productName} Data Processing Addendum`)] }),
          new Paragraph({ children: [new TextRun({ text: `Template version ${DPA_VERSION}`, italics: true })] }),
          ...dpaClauses().flatMap((clause) => [
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(clause.title)] }),
            ...clause.paragraphs.map((text) => new Paragraph({ spacing: { after: 160 }, children: [new TextRun(text)] })),
          ]),
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": 'attachment; filename="DraftBid-AI-DPA-template.docx"',
    },
  });
}
