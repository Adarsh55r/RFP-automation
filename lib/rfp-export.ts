import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";
import {
  columnWidths,
  relativeHeadingLevel,
  runsToPlainText,
  type InlineRun,
  type MdBlock,
  type TableAlign,
} from "@/lib/markdown";
import type { ProposalDocument, ReviewAppendix } from "@/lib/proposal-document";

const FONT = "Calibri";
const NAVY = "0B1F33";
const INK = "1C2836";
const BRAND = "0F6E5B";
const SLATE = "5A6878";
const RULE = "D5DDD9";
const TINT = "EEF5F2";
const STRIPE = "F6F9F8";
const BODY_SIZE = 21; // half-points → 10.5pt

const PAGE = {
  letter: { width: 12240, height: 15840 },
  a4: { width: 11906, height: 16838 },
};
const MARGIN = convertInchesToTwip(0.95);
/** Paragraphs shorter than this are kept on one page. */
const KEEP_TOGETHER_CHARS = 700;

type Block = Paragraph | Table;

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function textRuns(
  runs: InlineRun[],
  base: { size?: number; color?: string; bold?: boolean } = {},
) {
  if (runs.length === 0) {
    return [new TextRun({ text: "" })];
  }
  return runs.flatMap((run) =>
    run.text.split("\n").map(
      (part, index) =>
        new TextRun({
          text: part,
          break: index > 0 ? 1 : undefined,
          bold: run.bold || base.bold || run.placeholder,
          italics: run.italic,
          strike: run.strike,
          font: run.code ? "Consolas" : FONT,
          size: run.citation ? 16 : (base.size ?? BODY_SIZE),
          color: run.placeholder ? "7A4B00" : run.citation ? SLATE : (base.color ?? INK),
          highlight: run.placeholder ? "yellow" : undefined,
        }),
    ),
  );
}

function plain(text: string, opts: { size?: number; color?: string; bold?: boolean; italics?: boolean; allCaps?: boolean } = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? BODY_SIZE,
    color: opts.color ?? INK,
    bold: opts.bold,
    italics: opts.italics,
    allCaps: opts.allCaps,
  });
}

function alignment(align: TableAlign) {
  if (align === "center") return AlignmentType.CENTER;
  if (align === "right") return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
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
    default:
      return 0;
  }
}

type RenderContext = {
  contentWidth: number;
  headingLevel: (level: number) => number;
  sectionNumber: string | null;
  subheadingCount: number;
  nextListInstance: () => number;
};

function dataTable(
  header: InlineRun[][],
  rows: InlineRun[][][],
  align: TableAlign[],
  width: number,
  indent = 0,
): Table {
  // 9.5pt text (an average character is about 110 twips) plus 100 twips of padding each side.
  const columnCount = Math.max(header.length, ...rows.map((row) => row.length), 1);
  const text = columnWidths(header, rows, width - columnCount * 200, 110);
  const widths = text.map((value) => Math.round(value) + 200);
  widths[widths.length - 1] += width - widths.reduce((sum, value) => sum + value, 0);

  const rule = { style: BorderStyle.SINGLE, size: 4, color: RULE };
  const cell = (runs: InlineRun[], column: number, kind: "header" | "body", stripe: boolean) =>
    new TableCell({
      width: { size: widths[column], type: WidthType.DXA },
      margins: { top: 70, bottom: 70, left: 100, right: 100 },
      shading: {
        type: ShadingType.CLEAR,
        color: "auto",
        fill: kind === "header" ? BRAND : stripe ? STRIPE : "FFFFFF",
      },
      borders: { top: rule, bottom: rule, left: NO_BORDER, right: NO_BORDER },
      children: [
        new Paragraph({
          alignment: alignment(align[column] ?? null),
          spacing: { before: 0, after: 0, line: 250 },
          children: textRuns(runs, {
            size: 19,
            bold: kind === "header",
            color: kind === "header" ? "FFFFFF" : INK,
          }),
        }),
      ],
    });

  const columns = widths.length;
  const pad = (row: InlineRun[][]) => Array.from({ length: columns }, (_, index) => row[index] ?? []);

  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    indent: indent ? { size: indent, type: WidthType.DXA } : undefined,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: pad(header).map((runs, column) => cell(runs, column, "header", false)),
      }),
      ...rows.map(
        (row, rowIndex) =>
          new TableRow({
            cantSplit: true,
            children: pad(row).map((runs, column) => cell(runs, column, "body", rowIndex % 2 === 1)),
          }),
      ),
    ],
  });
}

function headingParagraph(block: Extract<MdBlock, { type: "heading" }>, ctx: RenderContext) {
  const level = ctx.headingLevel(block.level);
  if (level === 1) {
    const number = ctx.sectionNumber ? `${ctx.sectionNumber}.${(ctx.subheadingCount += 1)}` : null;
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
      keepLines: true,
      children: [
        ...(number ? [plain(`${number}   `, { size: 27, bold: true, color: BRAND })] : []),
        ...textRuns(block.runs, { size: 27, bold: true, color: NAVY }),
      ],
    });
  }
  return new Paragraph({
    heading: level === 2 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4,
    keepNext: true,
    keepLines: true,
    children: textRuns(block.runs, { size: level === 2 ? 23 : 21, bold: true, color: INK }),
  });
}

function renderBlocks(
  blocks: MdBlock[],
  ctx: RenderContext,
  list?: { level: number },
): Block[] {
  const out: Block[] = [];
  const indent = list ? convertInchesToTwip(0.3 * (list.level + 1)) : 0;

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        out.push(headingParagraph(block, ctx));
        break;
      case "paragraph":
        out.push(
          new Paragraph({
            spacing: { after: list ? 60 : 160, line: 288 },
            indent: indent ? { left: indent } : undefined,
            keepLines: plainLength(block) < KEEP_TOGETHER_CHARS,
            children: textRuns(block.runs),
          }),
        );
        break;
      case "list": {
        const instance = block.ordered ? ctx.nextListInstance() : 0;
        const level = list ? Math.min(list.level + 1, 2) : 0;
        for (const item of block.items) {
          const [first, ...rest] = item;
          const firstRuns = first && first.type === "paragraph" ? first.runs : [];
          out.push(
            new Paragraph({
              numbering: {
                reference: block.ordered ? "dw-numbered" : "dw-bullets",
                level,
                ...(block.ordered ? { instance } : {}),
              },
              spacing: { after: 70, line: 276 },
              keepLines: true,
              children: textRuns(firstRuns),
            }),
          );
          const remaining = first && first.type === "paragraph" ? rest : item;
          out.push(...renderBlocks(remaining, ctx, { level }));
        }
        if (!list) out.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        break;
      }
      case "table":
        out.push(dataTable(block.header, block.rows, block.align, ctx.contentWidth - indent, indent));
        out.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
        break;
      case "quote": {
        // Theme statements render as a tinted call-out with a brand-colored rule.
        const paragraphs = block.blocks.flatMap((inner) =>
          inner.type === "paragraph" ? [inner.runs] : inner.type === "heading" ? [inner.runs] : [],
        );
        paragraphs.forEach((runs, index) => {
          out.push(
            new Paragraph({
              spacing: { before: index === 0 ? 60 : 0, after: index === paragraphs.length - 1 ? 200 : 60, line: 276 },
              indent: { left: convertInchesToTwip(0.12) + indent, right: convertInchesToTwip(0.1) },
              keepLines: true,
              keepNext: index < paragraphs.length - 1,
              shading: { type: ShadingType.CLEAR, color: "auto", fill: TINT },
              border: { left: { style: BorderStyle.SINGLE, size: 24, color: BRAND, space: 8 } },
              children: textRuns(runs),
            }),
          );
        });
        break;
      }
      case "code":
        out.push(
          new Paragraph({
            spacing: { after: 140 },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: STRIPE },
            children: textRuns([{ text: block.text, code: true }], { size: 18 }),
          }),
        );
        break;
      case "hr":
        out.push(
          new Paragraph({
            spacing: { after: 140 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 1 } },
            children: [],
          }),
        );
        break;
    }
  }

  return out;
}

function sectionHeading(text: string) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      keepNext: true,
      spacing: { after: 120 },
      children: [plain(text, { size: 40, bold: true, color: NAVY })],
    }),
    // Short brand-colored accent rule under the section title.
    new Paragraph({
      spacing: { after: 280 },
      keepNext: true,
      children: [plain("▬▬▬", { size: 20, color: BRAND })],
    }),
  ];
}

function label(text: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [plain(text, { size: 16, bold: true, color: BRAND, allCaps: true })],
  });
}

function line(text: string, opts: { bold?: boolean; size?: number; color?: string; placeholder?: boolean } = {}) {
  return new Paragraph({
    spacing: { after: 40 },
    children: opts.placeholder
      ? textRuns([{ text, placeholder: true }], { size: opts.size })
      : [plain(text, { size: opts.size ?? 21, bold: opts.bold, color: opts.color ?? INK })],
  });
}

function twoColumns(left: Paragraph[], right: Paragraph[], width: number) {
  const half = Math.floor(width / 2);
  const column = (children: Paragraph[]) =>
    new TableCell({
      width: { size: half, type: WidthType.DXA },
      borders: NO_BORDERS,
      margins: { top: 0, bottom: 0, left: 0, right: 200 },
      children: children.length ? children : [new Paragraph({ children: [] })],
    });
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [half, width - half],
    layout: TableLayoutType.FIXED,
    borders: { ...NO_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows: [new TableRow({ children: [column(left), column(right)] })],
  });
}

function coverPage(doc: ProposalDocument, contentWidth: number): Block[] {
  const { cover } = doc;
  const contact = [
    cover.contactName && cover.contactTitle
      ? `${cover.contactName}, ${cover.contactTitle}`
      : cover.contactName || cover.contactTitle,
    cover.contactEmail,
    cover.contactPhone,
  ].filter(Boolean);

  const band = new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [contentWidth],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: contentWidth, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
            borders: { ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 24, color: BRAND } },
            margins: { top: 420, bottom: 420, left: 360, right: 360 },
            children: [
              new Paragraph({ spacing: { after: 80 }, children: [plain(cover.bidderName, { size: 30, bold: true, color: "FFFFFF" })] }),
              new Paragraph({ children: [plain("Response to Request for Proposal", { size: 17, bold: true, color: "BFD9D0", allCaps: true })] }),
            ],
          }),
        ],
      }),
    ],
  });

  return [
    band,
    new Paragraph({ spacing: { before: 1400, after: 160 }, children: [plain(cover.projectTitle, { size: 52, bold: true, color: NAVY })] }),
    new Paragraph({
      spacing: { after: 700 },
      children: cover.solicitationNumber
        ? [plain(`Solicitation No. ${cover.solicitationNumber}`, { size: 22, color: SLATE })]
        : [],
    }),
    twoColumns(
      [
        label("Prepared for"),
        cover.buyerName
          ? line(cover.buyerName, { bold: true, size: 24 })
          : line("[Buyer name]", { size: 24, placeholder: true }),
        ...(cover.buyerAddress ? [line(cover.buyerAddress, { color: SLATE })] : []),
      ],
      [
        label("Submitted by"),
        line(cover.bidderName, { bold: true, size: 24 }),
        ...contact.map((value) => line(value, { color: SLATE })),
      ],
      contentWidth,
    ),
    new Paragraph({
      spacing: { before: 500, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 1 } },
      children: [],
    }),
    twoColumns(
      doc.dateLabel ? [label("Submission date"), line(doc.dateLabel)] : [],
      cover.dueDate ? [label("Response due"), line(cover.dueDate)] : [],
      contentWidth,
    ),
    ...(doc.confidential
      ? [
          new Paragraph({
            spacing: { before: 1600 },
            children: [
              plain(
                `Confidential and proprietary to ${cover.bidderName.replace(/\.$/, "")}. Provided solely for the evaluation of this solicitation.`,
                { size: 16, italics: true, color: SLATE },
              ),
            ],
          }),
        ]
      : []),
  ];
}

/** Section and subsection headings, collected for the contents page. */
function outline(doc: ProposalDocument) {
  return doc.sections.map((section) => {
    const level = relativeHeadingLevel(section.blocks);
    const subheadings = section.numberSubheadings
      ? section.blocks
          .filter((block): block is Extract<MdBlock, { type: "heading" }> => block.type === "heading" && level(block.level) === 1)
          .map((block, index) => `${section.number}.${index + 1}   ${runsToPlainText(block.runs)}`)
      : [];
    return {
      title: section.number ? `${section.number}.  ${section.title}` : section.title,
      subheadings,
    };
  });
}

function contentsPage(doc: ProposalDocument): Paragraph[] {
  const entries = outline(doc);
  if (doc.complianceMatrix) entries.push({ title: "Appendix A.  Compliance Matrix", subheadings: [] });
  if (doc.review) entries.push({ title: REVIEW_APPENDIX_TITLE, subheadings: [] });
  return [
    ...sectionHeading("Contents"),
    ...entries.flatMap((entry) => [
      new Paragraph({
        spacing: { before: 160, after: 60 },
        keepNext: entry.subheadings.length > 0,
        children: [plain(entry.title, { size: 22, bold: true, color: INK })],
      }),
      ...entry.subheadings.map(
        (title) =>
          new Paragraph({
            spacing: { after: 40 },
            indent: { left: convertInchesToTwip(0.3) },
            children: [plain(title, { size: 19, color: SLATE })],
          }),
      ),
    ]),
  ];
}

const REVIEW_APPENDIX_TITLE = "Review notes (internal, remove before submitting)";
const REVIEW_BANNER =
  "INTERNAL REVIEW COPY: do not submit. Markers like [S2] show which library passage a claim came from; they are listed with the open items in the review notes at the end.";

function reviewAppendix(review: ReviewAppendix, contentWidth: number): Block[] {
  const note = (text: string) =>
    new Paragraph({ spacing: { after: 160 }, children: [plain(text, { color: SLATE })] });
  return [
    ...sectionHeading(REVIEW_APPENDIX_TITLE),
    note(
      "This internal copy shows where each claim came from. Check every open item, then export the submission copy, which has no markers or notes.",
    ),
    new Paragraph({ spacing: { before: 120, after: 80 }, children: [plain("Open items", { bold: true, size: 24 })] }),
    review.openItems.length > 0
      ? dataTable(
          [[{ text: "Section" }], [{ text: "Type" }], [{ text: "Item" }]],
          review.openItems.map((item) => [[{ text: item.section }], [{ text: item.kind }], [{ text: item.text }]]),
          ["left", "left", "left"],
          contentWidth,
        )
      : note("No open items were found. Still read the whole draft before submitting."),
    new Paragraph({ spacing: { before: 240, after: 80 }, children: [plain("Sources cited", { bold: true, size: 24 })] }),
    review.sources.length > 0
      ? dataTable(
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

export function buildProposalDocx(doc: ProposalDocument) {
  const page = PAGE[doc.pageSize];
  const contentWidth = page.width - MARGIN * 2;
  const { cover } = doc;
  let listInstance = 0;
  const reference = cover.solicitationNumber ? `Response to ${cover.solicitationNumber}` : cover.projectTitle;

  const body: Block[] = [...coverPage(doc, contentWidth), ...contentsPage(doc)];
  if (doc.review) {
    body.push(
      new Paragraph({
        spacing: { before: 240, after: 120 },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: "B42318", space: 8 } },
        children: [plain(REVIEW_BANNER, { bold: true, color: "B42318" })],
      }),
    );
  }

  for (const section of doc.sections) {
    body.push(
      ...sectionHeading(section.number ? `${section.number}.  ${section.title}` : section.title),
      ...renderBlocks(section.blocks, {
        contentWidth,
        headingLevel: relativeHeadingLevel(section.blocks),
        sectionNumber: section.numberSubheadings ? section.number : null,
        subheadingCount: 0,
        nextListInstance: () => (listInstance += 1),
      }),
    );
  }

  if (doc.complianceMatrix) {
    body.push(
      ...sectionHeading("Appendix A.  Compliance Matrix"),
      new Paragraph({
        spacing: { after: 160 },
        children: [plain("Each requirement of the solicitation and where this proposal responds to it.", { color: SLATE })],
      }),
      dataTable(
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
    );
  }

  if (doc.review) {
    body.push(...reviewAppendix(doc.review, contentWidth));
  }

  const rightTab = [{ type: TabStopType.RIGHT, position: contentWidth }];

  return new Document({
    creator: cover.bidderName,
    title: `${cover.projectTitle} — Proposal`,
    description: `Proposal from ${cover.bidderName}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_SIZE, color: INK } },
        heading1: { run: { font: FONT, size: 40, bold: true, color: NAVY } },
        heading2: {
          run: { font: FONT, size: 27, bold: true, color: NAVY },
          paragraph: { spacing: { before: 320, after: 120 } },
        },
        heading3: {
          run: { font: FONT, size: 23, bold: true, color: INK },
          paragraph: { spacing: { before: 240, after: 100 } },
        },
        heading4: {
          run: { font: FONT, size: 21, bold: true, color: INK },
          paragraph: { spacing: { before: 180, after: 80 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "dw-bullets",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.BULLET,
            text: ["•", "–", "▪"][level],
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(0.3 + 0.3 * level), hanging: convertInchesToTwip(0.2) },
              },
            },
          })),
        },
        {
          reference: "dw-numbered",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level],
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(0.35 + 0.3 * level), hanging: convertInchesToTwip(0.25) },
              },
            },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: page.width, height: page.height },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 500, footer: 500 },
          },
        },
        headers: {
          first: new Header({ children: [] }),
          default: new Header({
            children: [
              new Paragraph({
                tabStops: rightTab,
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
                children: [
                  plain(cover.bidderName, { size: 16, bold: true, color: NAVY }),
                  plain(`\t${reference}`, { size: 16, color: SLATE }),
                ],
              }),
            ],
          }),
        },
        footers: {
          first: new Footer({ children: [] }),
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: rightTab,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
                children: [
                  plain(doc.review ? "INTERNAL REVIEW COPY: do not submit" : doc.confidential ? "Confidential" : doc.footerLabel, {
                    size: 16,
                    color: doc.review ? "B42318" : SLATE,
                    bold: Boolean(doc.review),
                  }),
                  new TextRun({
                    font: FONT,
                    size: 16,
                    color: SLATE,
                    children: ["\tPage ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
                  }),
                ],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });
}

export async function buildProposalDocxBuffer(doc: ProposalDocument) {
  return Packer.toBuffer(buildProposalDocx(doc));
}
