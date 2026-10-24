import PdfPrinter from "pdfmake";
import vfsModule from "pdfmake/build/vfs_fonts";
import type {
  Content,
  ContentText,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import {
  columnWidths,
  relativeHeadingLevel,
  runsToPlainText,
  type InlineRun,
  type MdBlock,
} from "@/lib/markdown";
import type { ProposalDocument, ReviewAppendix } from "@/lib/proposal-document";

const NAVY = "#0B1F33";
const INK = "#1C2836";
const BRAND = "#0F6E5B";
const SLATE = "#5A6878";
const RULE = "#D5DDD9";
const TINT = "#EEF5F2";
const STRIPE = "#F6F9F8";
const PLACEHOLDER_FILL = "#FFF1A8";

const PAGE = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
};
const SIDE_MARGIN = 68;
const TOP_MARGIN = 84;
const BOTTOM_MARGIN = 72;
/** Paragraphs shorter than this move to the next page whole instead of splitting. */
const KEEP_TOGETHER_CHARS = 700;

type VfsShape = Record<string, string> & {
  pdfMake?: { vfs: Record<string, string> };
  vfs?: Record<string, string>;
};

let printer: PdfPrinter | null = null;

function getPrinter() {
  if (printer) return printer;
  // The vfs bundle's export shape differs between pdfmake builds.
  const raw = vfsModule as unknown as VfsShape;
  const vfs = raw.pdfMake?.vfs ?? raw.vfs ?? raw;
  const font = (name: string) => Buffer.from(vfs[name], "base64");
  printer = new PdfPrinter({
    Roboto: {
      normal: font("Roboto-Regular.ttf"),
      bold: font("Roboto-Medium.ttf"),
      italics: font("Roboto-Italic.ttf"),
      bolditalics: font("Roboto-MediumItalic.ttf"),
    },
  });
  return printer;
}

function inline(runs: InlineRun[]): ContentText["text"] {
  if (runs.length === 0) return "";
  return runs.map((run) => ({
    text: run.text,
    bold: run.bold || run.placeholder,
    italics: run.italic,
    decoration: run.strike ? ("lineThrough" as const) : undefined,
    background: run.placeholder ? PLACEHOLDER_FILL : run.code ? STRIPE : undefined,
    color: run.placeholder ? "#7A4B00" : run.citation ? SLATE : undefined,
    fontSize: run.code ? 9 : run.citation ? 8 : undefined,
  }));
}

function plainLength(block: MdBlock): number {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return runsToPlainText(block.runs).length;
    case "list":
      return block.items.flat().reduce((sum, inner) => sum + plainLength(inner), 0);
    case "quote":
      return block.blocks.reduce((sum, inner) => sum + plainLength(inner), 0);
    case "code":
      return block.text.length;
    default:
      return 0;
  }
}

function tableContent(
  header: InlineRun[][],
  rows: InlineRun[][][],
  align: ("left" | "center" | "right" | null)[],
  width: number,
): Content {
  const columns = Math.max(header.length, ...rows.map((row) => row.length), 1);
  // Cell padding (5pt each side) is added outside the declared widths; 9.5pt
  // Roboto averages about 5.5pt a character.
  const widths = columnWidths(header, rows, width - columns * 10, 5.5);
  const pad = (row: InlineRun[][]) =>
    Array.from({ length: columns }, (_, index) => row[index] ?? []);
  const alignment = (column: number) => align[column] ?? "left";

  const body: TableCell[][] = [
    pad(header).map((runs, column) => ({
      text: inline(runs),
      bold: true,
      color: "#FFFFFF",
      fillColor: BRAND,
      alignment: alignment(column),
    })),
    ...rows.map((row, rowIndex) =>
      pad(row).map((runs, column) => ({
        text: inline(runs),
        fillColor: rowIndex % 2 === 1 ? STRIPE : undefined,
        alignment: alignment(column),
      })),
    ),
  ];

  return {
    table: { headerRows: 1, dontBreakRows: true, widths, body },
    layout: {
      hLineWidth: (index: number) => (index === 0 ? 0 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => RULE,
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    fontSize: 9.5,
    lineHeight: 1.2,
    margin: [0, 4, 0, 12],
  };
}

function callout(content: Content[], width: number): Content {
  return {
    table: { widths: [width - 26], body: [[{ stack: content, color: INK }]] },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (index: number) => (index === 0 ? 3 : 0),
      vLineColor: () => BRAND,
      fillColor: () => TINT,
      paddingLeft: () => 12,
      paddingRight: () => 10,
      paddingTop: () => 8,
      paddingBottom: () => 2,
    },
    margin: [0, 2, 0, 12],
    unbreakable: true,
  };
}

type RenderContext = {
  headingLevel: (level: number) => number;
  /** Section number for "1.1"-style subheadings, or null to leave them unnumbered. */
  sectionNumber: string | null;
  subheadingCount: number;
};

function headingNode(block: Extract<MdBlock, { type: "heading" }>, ctx: RenderContext): Content {
  const level = ctx.headingLevel(block.level);
  if (level === 1) {
    const number = ctx.sectionNumber ? `${ctx.sectionNumber}.${(ctx.subheadingCount += 1)}` : null;
    const text = runsToPlainText(block.runs);
    return {
      text: number ? [{ text: `${number}   `, color: BRAND }, { text }] : text,
      style: "h2",
      headlineLevel: 1,
      ...(number
        ? {
            tocItem: true,
            tocStyle: { fontSize: 9.5, color: SLATE },
            tocMargin: [16, 2, 0, 0],
            tocNumberStyle: { fontSize: 9.5, color: SLATE },
          }
        : {}),
    } as Content;
  }
  return { text: inline(block.runs), style: level === 2 ? "h3" : "h4", headlineLevel: 1 };
}

function renderBlocks(
  blocks: MdBlock[],
  ctx: RenderContext,
  width: number,
  inList = false,
): Content[] {
  const out: Content[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    switch (block.type) {
      case "heading": {
        const heading = headingNode(block, ctx);
        const next = blocks[index + 1];
        // Keep a heading on the same page as the text that follows it.
        if (next && (next.type === "paragraph" || next.type === "list") && plainLength(next) < KEEP_TOGETHER_CHARS) {
          out.push({ stack: [heading, ...renderBlocks([next], ctx, width, inList)], unbreakable: true });
          index += 1;
        } else {
          out.push(heading);
        }
        break;
      }
      case "paragraph":
        out.push({
          text: inline(block.runs),
          margin: [0, 0, 0, inList ? 3 : 8],
          ...(plainLength(block) < KEEP_TOGETHER_CHARS ? { unbreakable: true } : {}),
        } as Content);
        break;
      case "list": {
        const items = block.items.map((item) => {
          const parts = renderBlocks(item, ctx, width - 18, true);
          const node: Content = parts.length === 1 ? parts[0] : { stack: parts };
          // A short bullet never splits across pages.
          return plainLength({ type: "list", ordered: false, start: 1, items: [item] }) < KEEP_TOGETHER_CHARS
            ? ({ stack: [node], unbreakable: true } as Content)
            : node;
        });
        out.push(
          block.ordered
            ? { ol: items, start: block.start, margin: [0, 0, 0, inList ? 2 : 8] }
            : { ul: items, margin: [0, 0, 0, inList ? 2 : 8] },
        );
        break;
      }
      case "table":
        out.push(tableContent(block.header, block.rows, block.align, width));
        break;
      case "quote":
        out.push(callout(renderBlocks(block.blocks, ctx, width - 26), width));
        break;
      case "code":
        out.push({
          text: block.text,
          fontSize: 8.5,
          background: STRIPE,
          preserveLeadingSpaces: true,
          margin: [0, 0, 0, 8],
        });
        break;
      case "hr":
        out.push({
          canvas: [{ type: "line", x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.5, lineColor: RULE }],
          margin: [0, 4, 0, 10],
        });
        break;
    }
  }

  return out;
}

function sectionTitle(text: string): Content[] {
  return [
    {
      text,
      style: "h1",
      pageBreak: "before",
      tocItem: true,
      tocStyle: { bold: true, color: INK },
      tocMargin: [0, 8, 0, 0],
    } as Content,
    {
      canvas: [{ type: "rect", x: 0, y: 0, w: 44, h: 3, color: BRAND }],
      margin: [0, 0, 0, 16],
    },
  ];
}

function coverPage(doc: ProposalDocument, contentWidth: number): Content[] {
  const { cover } = doc;
  const label = (text: string): Content => ({
    text: text.toUpperCase(),
    fontSize: 8,
    bold: true,
    color: BRAND,
    characterSpacing: 1.2,
    margin: [0, 0, 0, 6],
  });
  const line = (text: string, opts: Record<string, unknown> = {}): Content[] =>
    text ? [{ text, fontSize: 10.5, color: INK, margin: [0, 0, 0, 2], ...opts } as Content] : [];

  const contact = [
    cover.contactName && cover.contactTitle
      ? `${cover.contactName}, ${cover.contactTitle}`
      : cover.contactName || cover.contactTitle,
    cover.contactEmail,
    cover.contactPhone,
  ].filter(Boolean);

  const blocks: Content[] = [
    // Sits on the dark band drawn by the page-1 background.
    {
      text: cover.bidderName,
      color: "#FFFFFF",
      fontSize: 15,
      bold: true,
      margin: [0, -20, 0, 6],
    },
    {
      text: "RESPONSE TO REQUEST FOR PROPOSAL",
      color: "#BFD9D0",
      fontSize: 8.5,
      bold: true,
      characterSpacing: 1.4,
      margin: [0, 0, 0, 120],
    },
    { text: cover.projectTitle, fontSize: 26, bold: true, color: NAVY, lineHeight: 1.1, margin: [0, 0, 0, 10] },
    ...(cover.solicitationNumber
      ? ([{ text: `Solicitation No. ${cover.solicitationNumber}`, fontSize: 11, color: SLATE, margin: [0, 0, 0, 34] }] as Content[])
      : ([{ text: "", margin: [0, 0, 0, 24] }] as Content[])),
    {
      columns: [
        {
          width: "*",
          stack: [
            label("Prepared for"),
            ...(cover.buyerName
              ? line(cover.buyerName, { bold: true, fontSize: 12 })
              : line("[Buyer name]", { bold: true, fontSize: 12, background: PLACEHOLDER_FILL, color: "#7A4B00" })),
            ...line(cover.buyerAddress, { color: SLATE }),
          ],
        },
        {
          width: "*",
          stack: [
            label("Submitted by"),
            ...line(cover.bidderName, { bold: true, fontSize: 12 }),
            ...contact.flatMap((value) => line(value, { color: SLATE })),
          ],
        },
      ],
      columnGap: 28,
      margin: [0, 0, 0, 30],
    },
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.6, lineColor: RULE }],
      margin: [0, 0, 0, 12],
    },
    {
      columns: [
        { width: "*", stack: doc.dateLabel ? [label("Submission date"), ...line(doc.dateLabel)] : [] },
        { width: "*", stack: cover.dueDate ? [label("Response due"), ...line(cover.dueDate)] : [] },
      ],
      columnGap: 28,
    },
    {
      // A fixed-width column keeps the notice wrapping inside the cover page.
      columns: [
        {
          width: contentWidth,
          text: `Confidential and proprietary to ${cover.bidderName.replace(/\.$/, "")}. Provided solely for the evaluation of this solicitation.`,
          fontSize: 8,
          italics: true,
          color: SLATE,
        },
      ],
      absolutePosition: { x: SIDE_MARGIN, y: PAGE[doc.pageSize].height - 130 },
    } as Content,
  ];
  return doc.confidential ? blocks : blocks.slice(0, -1);
}

function reviewAppendix(review: ReviewAppendix, contentWidth: number): Content[] {
  const note = (text: string): Content => ({ text, color: SLATE, margin: [0, 0, 0, 10] });
  return [
    ...sectionTitle("Review notes (internal, remove before submitting)"),
    note(
      "This internal copy shows where each claim came from. Check every open item, then export the submission copy, which has no markers or notes.",
    ),
    { text: "Open items", style: "h2" },
    review.openItems.length > 0
      ? tableContent(
          [[{ text: "Section" }], [{ text: "Type" }], [{ text: "Item" }]],
          review.openItems.map((item) => [[{ text: item.section }], [{ text: item.kind }], [{ text: item.text }]]),
          ["left", "left", "left"],
          contentWidth,
        )
      : note("No open items were found. Still read the whole draft before submitting."),
    { text: "Sources cited", style: "h2" },
    review.sources.length > 0
      ? tableContent(
          [[{ text: "Section" }], [{ text: "Marker" }], [{ text: "Library item" }], [{ text: "Passage" }]],
          review.sources.map((source) => [
            [{ text: source.section }],
            [{ text: source.id }],
            [{ text: source.title }],
            [{ text: source.excerpt }],
          ]),
          ["left", "left", "left", "left"],
          contentWidth,
        )
      : note("This draft cites no library passages."),
  ];
}

function definition(doc: ProposalDocument): TDocumentDefinitions {
  const page = PAGE[doc.pageSize];
  const contentWidth = page.width - SIDE_MARGIN * 2;
  const { cover } = doc;
  const reference = cover.solicitationNumber
    ? `Response to ${cover.solicitationNumber}`
    : cover.projectTitle;

  const contents: Content[] = [
    { text: "Contents", style: "h1", pageBreak: "before" },
    { canvas: [{ type: "rect", x: 0, y: 0, w: 44, h: 3, color: BRAND }], margin: [0, 0, 0, 14] },
    { toc: { numberStyle: { color: SLATE } } } as Content,
    ...(doc.review
      ? [
          {
            text: "INTERNAL REVIEW COPY: do not submit. Markers like [S2] show which library passage a claim came from; they are listed with the open items in the review notes at the end.",
            bold: true,
            color: "#B42318",
            margin: [0, 16, 0, 0],
          } as Content,
        ]
      : []),
  ];

  const sections: Content[] = doc.sections.flatMap((section) => {
    const ctx: RenderContext = {
      headingLevel: relativeHeadingLevel(section.blocks),
      sectionNumber: section.numberSubheadings ? section.number : null,
      subheadingCount: 0,
    };
    return [
      ...sectionTitle(section.number ? `${section.number}.  ${section.title}` : section.title),
      ...renderBlocks(section.blocks, ctx, contentWidth),
    ];
  });

  const appendix: Content[] = doc.complianceMatrix
    ? [
        ...sectionTitle("Appendix A. Compliance Matrix"),
        {
          text: "Each requirement of the solicitation and where this proposal responds to it.",
          color: SLATE,
          margin: [0, 0, 0, 10],
        },
        tableContent(
          [[{ text: "#" }], [{ text: "Requirement" }], [{ text: "Type" }], [{ text: "Proposal reference" }]],
          doc.complianceMatrix.map((row, index) => [
            [{ text: String(index + 1) }],
            [{ text: row.requirement }],
            [{ text: row.type }],
            [{ text: row.reference.replace(/^\[\[(.*)\]\]$/, "[$1]"), placeholder: row.reference.startsWith("[[") }],
          ]),
          ["left", "left", "left", "left"],
          contentWidth,
        ),
      ]
    : [];

  return {
    pageSize: doc.pageSize === "a4" ? "A4" : "LETTER",
    pageMargins: [SIDE_MARGIN, TOP_MARGIN, SIDE_MARGIN, BOTTOM_MARGIN],
    info: {
      title: `${cover.projectTitle} — Proposal`,
      author: cover.bidderName,
      creator: cover.bidderName,
    },
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.32, color: INK },
    styles: {
      h1: { fontSize: 21, bold: true, color: NAVY, margin: [0, 0, 0, 8] },
      h2: { fontSize: 13.5, bold: true, color: NAVY, margin: [0, 14, 0, 6] },
      h3: { fontSize: 11.5, bold: true, color: INK, margin: [0, 10, 0, 4] },
      h4: { fontSize: 10.5, bold: true, color: INK, margin: [0, 8, 0, 3] },
    },
    background: (currentPage) =>
      currentPage === 1
        ? {
            canvas: [
              { type: "rect", x: 0, y: 0, w: page.width, h: 168, color: NAVY },
              { type: "rect", x: 0, y: 168, w: page.width, h: 4, color: BRAND },
            ],
          }
        : "",
    header: (currentPage) =>
      currentPage === 1
        ? ""
        : {
            margin: [SIDE_MARGIN, 34, SIDE_MARGIN, 0],
            stack: [
              {
                columns: [
                  { text: cover.bidderName, bold: true, fontSize: 8, color: NAVY },
                  { text: reference, alignment: "right", fontSize: 8, color: SLATE },
                ],
              },
              {
                canvas: [{ type: "line", x1: 0, y1: 4, x2: contentWidth, y2: 4, lineWidth: 0.5, lineColor: RULE }],
              },
            ],
          },
    footer: (currentPage, pageCount) =>
      currentPage === 1
        ? ""
        : {
            margin: [SIDE_MARGIN, 18, SIDE_MARGIN, 0],
            stack: [
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.5, lineColor: RULE }] },
              {
                margin: [0, 6, 0, 0],
                columns: [
                  doc.review
                    ? { text: "INTERNAL REVIEW COPY: do not submit", fontSize: 8, bold: true, color: "#B42318" }
                    : { text: doc.confidential ? "Confidential" : doc.footerLabel, fontSize: 8, color: SLATE },
                  { text: `Page ${currentPage} of ${pageCount}`, alignment: "right", fontSize: 8, color: SLATE },
                ],
              },
            ],
          },
    // Never leave a heading stranded at the bottom of a page.
    pageBreakBefore: (current, following) =>
      current.headlineLevel === 1 && following.length === 0,
    content: [
      ...coverPage(doc, contentWidth),
      ...contents,
      ...sections,
      ...appendix,
      ...(doc.review ? reviewAppendix(doc.review, contentWidth) : []),
    ],
  };
}

export function buildProposalPdfBuffer(doc: ProposalDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const pdf = getPrinter().createPdfKitDocument(definition(doc));
      const chunks: Buffer[] = [];
      pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.on("error", reject);
      pdf.end();
    } catch (error) {
      reject(error);
    }
  });
}
