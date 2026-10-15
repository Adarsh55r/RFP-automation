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
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";
import {
  columnWeights,
  relativeHeadingLevel,
  type InlineRun,
  type MdBlock,
  type TableAlign,
} from "@/lib/markdown";
import type { ProposalDocument } from "@/lib/proposal-document";

const FONT = "Calibri";
const INK = "0B1F33";
const BRAND = "0F6E5B";
const SLATE = "445566";
const BORDER = "C9D3CE";
const HEADER_FILL = "E8F1EE";
const STRIPE_FILL = "F7FAF9";
const BODY_SIZE = 22; // half-points → 11pt

const PAGE = {
  letter: { width: 12240, height: 15840 },
  a4: { width: 11906, height: 16838 },
};
const MARGIN = convertInchesToTwip(1);

type Block = Paragraph | Table;

function textRuns(runs: InlineRun[], base: { size?: number; color?: string; bold?: boolean } = {}) {
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
          size: base.size ?? BODY_SIZE,
          color: run.placeholder ? "7A4B00" : (base.color ?? INK),
          highlight: run.placeholder ? "yellow" : undefined,
        }),
    ),
  );
}

function alignment(align: TableAlign) {
  if (align === "center") return AlignmentType.CENTER;
  if (align === "right") return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

type RenderContext = {
  contentWidth: number;
  headingLevel: (level: number) => number;
  nextListInstance: () => number;
};

function tableBlock(
  block: Extract<MdBlock, { type: "table" }>,
  ctx: RenderContext,
  indent: number,
): Table {
  const width = ctx.contentWidth - indent;
  const weights = columnWeights(block.header, block.rows);
  const minWidth = 900;
  const widths = weights.map((weight) => Math.max(Math.round(weight * width), minWidth));
  // Re-balance so the columns add up to exactly the available width.
  const overflow = widths.reduce((sum, value) => sum + value, 0) - width;
  if (overflow !== 0) {
    const widest = widths.indexOf(Math.max(...widths));
    widths[widest] -= overflow;
  }

  const border = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
  const cell = (runs: InlineRun[], column: number, kind: "header" | "body", stripe: boolean) =>
    new TableCell({
      width: { size: widths[column], type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      shading: {
        type: ShadingType.CLEAR,
        color: "auto",
        fill: kind === "header" ? HEADER_FILL : stripe ? STRIPE_FILL : "FFFFFF",
      },
      borders: { top: border, bottom: border, left: border, right: border },
      children: [
        new Paragraph({
          alignment: alignment(block.align[column] ?? null),
          spacing: { before: 0, after: 0, line: 252 },
          children: textRuns(runs, {
            size: 19,
            bold: kind === "header",
            color: kind === "header" ? BRAND : INK,
          }),
        }),
      ],
    });

  const columns = widths.length;
  const pad = (row: InlineRun[][]) =>
    Array.from({ length: columns }, (_, index) => row[index] ?? []);

  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    indent: indent ? { size: indent, type: WidthType.DXA } : undefined,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: pad(block.header).map((runs, column) => cell(runs, column, "header", false)),
      }),
      ...block.rows.map(
        (row, rowIndex) =>
          new TableRow({
            cantSplit: true,
            children: pad(row).map((runs, column) =>
              cell(runs, column, "body", rowIndex % 2 === 1),
            ),
          }),
      ),
    ],
  });
}

function renderBlocks(
  blocks: MdBlock[],
  ctx: RenderContext,
  list?: { ordered: boolean; level: number; instance: number },
): Block[] {
  const out: Block[] = [];
  const indent = list ? convertInchesToTwip(0.25 * (list.level + 1)) : 0;

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const level = ctx.headingLevel(block.level);
        out.push(
          new Paragraph({
            heading:
              level === 1
                ? HeadingLevel.HEADING_2
                : level === 2
                  ? HeadingLevel.HEADING_3
                  : HeadingLevel.HEADING_4,
            keepNext: true,
            children: textRuns(block.runs, {
              size: level === 1 ? 28 : level === 2 ? 24 : 22,
              bold: true,
              color: level === 1 ? BRAND : INK,
            }),
          }),
        );
        break;
      }
      case "paragraph":
        out.push(
          new Paragraph({
            spacing: { after: 140, line: 276 },
            indent: indent ? { left: indent } : undefined,
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
              spacing: { after: 60, line: 264 },
              children: textRuns(firstRuns),
            }),
          );
          const remaining = first && first.type === "paragraph" ? rest : item;
          out.push(
            ...renderBlocks(remaining, ctx, { ordered: block.ordered, level, instance }),
          );
        }
        // Breathing room after the outermost list.
        if (!list) out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        break;
      }
      case "table":
        out.push(tableBlock(block, ctx, indent));
        out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
      case "quote":
        for (const inner of renderBlocks(block.blocks, ctx, list)) {
          out.push(inner);
        }
        break;
      case "code":
        out.push(
          new Paragraph({
            spacing: { after: 140 },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: STRIPE_FILL },
            children: textRuns([{ text: block.text, code: true }], { size: 18 }),
          }),
        );
        break;
      case "hr":
        out.push(
          new Paragraph({
            spacing: { after: 140 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 1 } },
            children: [],
          }),
        );
        break;
    }
  }

  return out;
}

function centered(text: string, size: number, opts: { bold?: boolean; color?: string; before?: number; after?: number; italics?: boolean } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 120 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color ?? INK,
      }),
    ],
  });
}

function coverPage(doc: ProposalDocument): Paragraph[] {
  const meta: Paragraph[] = [];
  if (doc.solicitationNumber) {
    meta.push(centered(`Solicitation No. ${doc.solicitationNumber}`, 22, { color: SLATE, after: 60 }));
  }
  if (doc.dueDate) {
    meta.push(centered(`Due ${doc.dueDate}`, 22, { color: SLATE, after: 60 }));
  }

  return [
    new Paragraph({
      spacing: { after: 1800 },
      border: { top: { style: BorderStyle.SINGLE, size: 36, color: BRAND, space: 1 } },
      children: [],
    }),
    centered("PROPOSAL", 22, { bold: true, color: BRAND, after: 240 }),
    centered(doc.rfpTitle, 44, { bold: true, after: 360 }),
    ...(doc.buyerName
      ? [
          centered("Prepared for", 20, { color: SLATE, after: 40 }),
          centered(doc.buyerName, 30, { bold: true, after: 240 }),
        ]
      : []),
    ...meta,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 360, after: 360 },
      border: { top: { style: BorderStyle.SINGLE, size: 8, color: BORDER, space: 8 } },
      children: [],
    }),
    centered("Submitted by", 20, { color: SLATE, after: 40 }),
    centered(doc.companyName, 30, { bold: true, after: 120 }),
    centered(doc.dateLabel, 22, { color: SLATE, after: 1400 }),
    centered("This proposal contains confidential and proprietary information.", 18, {
      italics: true,
      color: SLATE,
    }),
  ];
}

function contentsPage(doc: ProposalDocument): Paragraph[] {
  return [
    new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
      children: [new TextRun({ text: "Contents", font: FONT, size: 32, bold: true, color: INK })],
    }),
    ...doc.sections.map(
      (section) =>
        new Paragraph({
          spacing: { after: 120 },
          border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: BORDER, space: 4 } },
          children: [
            new TextRun({
              text: section.number ? `${section.number}.  ` : "",
              font: FONT,
              size: 24,
              bold: true,
              color: BRAND,
            }),
            new TextRun({ text: section.title, font: FONT, size: 24, color: INK }),
          ],
        }),
    ),
  ];
}

export function buildProposalDocx(doc: ProposalDocument) {
  const page = PAGE[doc.pageSize];
  const contentWidth = page.width - MARGIN * 2;
  let listInstance = 0;

  const body: Block[] = [...coverPage(doc), ...contentsPage(doc)];

  for (const section of doc.sections) {
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 280 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 8 } },
        children: [
          new TextRun({
            text: section.number ? `${section.number}. ${section.title}` : section.title,
            font: FONT,
            size: 34,
            bold: true,
            color: INK,
          }),
        ],
      }),
      ...renderBlocks(section.blocks, {
        contentWidth,
        headingLevel: relativeHeadingLevel(section.blocks),
        nextListInstance: () => (listInstance += 1),
      }),
    );
  }

  const small = (text: string) =>
    new TextRun({ text, font: FONT, size: 16, color: SLATE });

  return new Document({
    creator: doc.companyName,
    title: `${doc.rfpTitle} — Proposal`,
    description: `Proposal from ${doc.companyName}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_SIZE, color: INK } },
        heading1: { run: { font: FONT, size: 34, bold: true, color: INK } },
        heading2: {
          run: { font: FONT, size: 28, bold: true, color: BRAND },
          paragraph: { spacing: { before: 280, after: 120 } },
        },
        heading3: {
          run: { font: FONT, size: 24, bold: true, color: INK },
          paragraph: { spacing: { before: 220, after: 100 } },
        },
        heading4: {
          run: { font: FONT, size: 22, bold: true, color: INK },
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
                alignment: AlignmentType.RIGHT,
                children: [small(`${doc.companyName}  |  ${doc.rfpTitle}`)],
              }),
            ],
          }),
        },
        footers: {
          first: new Footer({ children: [] }),
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    font: FONT,
                    size: 16,
                    color: SLATE,
                    children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
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
