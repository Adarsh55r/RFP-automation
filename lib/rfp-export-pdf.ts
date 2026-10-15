import PdfPrinter from "pdfmake";
import vfsModule from "pdfmake/build/vfs_fonts";
import type {
  Content,
  ContentText,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import {
  columnWeights,
  relativeHeadingLevel,
  type InlineRun,
  type MdBlock,
} from "@/lib/markdown";
import type { ProposalDocument } from "@/lib/proposal-document";

const INK = "#0B1F33";
const BRAND = "#0F6E5B";
const SLATE = "#445566";
const BORDER = "#C9D3CE";
const HEADER_FILL = "#E8F1EE";
const STRIPE_FILL = "#F7FAF9";
const PLACEHOLDER_FILL = "#FFF1A8";

const PAGE_WIDTH = { letter: 612, a4: 595.28 };
const MARGIN = 72;

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
    background: run.placeholder ? PLACEHOLDER_FILL : run.code ? STRIPE_FILL : undefined,
    color: run.placeholder ? "#7A4B00" : undefined,
    fontSize: run.code ? 9 : undefined,
  }));
}

type RenderContext = {
  contentWidth: number;
  headingLevel: (level: number) => number;
};

function tableContent(
  block: Extract<MdBlock, { type: "table" }>,
  width: number,
): Content {
  const weights = columnWeights(block.header, block.rows);
  const columns = weights.length;
  // Cell padding (4pt each side) is added outside the declared widths.
  const usable = width - columns * 8;
  const widths = weights.map((weight) => Math.max(weight * usable, 36));
  const pad = (row: InlineRun[][]) =>
    Array.from({ length: columns }, (_, index) => row[index] ?? []);
  const align = (column: number) => block.align[column] ?? "left";

  const body: TableCell[][] = [
    pad(block.header).map((runs, column) => ({
      text: inline(runs),
      bold: true,
      color: BRAND,
      fillColor: HEADER_FILL,
      alignment: align(column),
    })),
    ...block.rows.map((row, rowIndex) =>
      pad(row).map((runs, column) => ({
        text: inline(runs),
        fillColor: rowIndex % 2 === 1 ? STRIPE_FILL : undefined,
        alignment: align(column),
      })),
    ),
  ];

  return {
    table: { headerRows: 1, dontBreakRows: true, widths, body },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => BORDER,
      vLineColor: () => BORDER,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    fontSize: 9.5,
    margin: [0, 2, 0, 10],
  };
}

function renderBlocks(
  blocks: MdBlock[],
  ctx: RenderContext,
  width: number,
  inList = false,
): Content[] {
  const out: Content[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const level = ctx.headingLevel(block.level);
        out.push({
          text: inline(block.runs),
          style: level === 1 ? "h2" : level === 2 ? "h3" : "h4",
          headlineLevel: 1,
        });
        break;
      }
      case "paragraph":
        out.push({ text: inline(block.runs), margin: [0, 0, 0, inList ? 3 : 7] });
        break;
      case "list": {
        const items = block.items.map((item) => {
          const parts = renderBlocks(item, ctx, width - 18, true);
          return parts.length === 1 ? parts[0] : { stack: parts };
        });
        out.push(
          block.ordered
            ? { ol: items, start: block.start, margin: [0, 0, 0, inList ? 2 : 7] }
            : { ul: items, margin: [0, 0, 0, inList ? 2 : 7] },
        );
        break;
      }
      case "table":
        out.push(tableContent(block, width));
        break;
      case "quote":
        out.push({
          stack: renderBlocks(block.blocks, ctx, width - 14),
          margin: [14, 0, 0, 7],
          italics: true,
        });
        break;
      case "code":
        out.push({
          text: block.text,
          fontSize: 8.5,
          background: STRIPE_FILL,
          preserveLeadingSpaces: true,
          margin: [0, 0, 0, 7],
        });
        break;
      case "hr":
        out.push({
          canvas: [{ type: "line", x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.5, lineColor: BORDER }],
          margin: [0, 4, 0, 10],
        });
        break;
    }
  }

  return out;
}

function definition(doc: ProposalDocument): TDocumentDefinitions {
  const contentWidth = PAGE_WIDTH[doc.pageSize] - MARGIN * 2;

  const cover: Content[] = [
    { canvas: [{ type: "rect", x: 0, y: 0, w: contentWidth, h: 5, color: BRAND }], margin: [0, 0, 0, 110] },
    { text: "PROPOSAL", alignment: "center", bold: true, color: BRAND, fontSize: 11, characterSpacing: 2, margin: [0, 0, 0, 14] },
    { text: doc.rfpTitle, alignment: "center", bold: true, fontSize: 24, margin: [0, 0, 0, 26] },
    ...(doc.buyerName
      ? ([
          { text: "Prepared for", alignment: "center", color: SLATE, fontSize: 10 },
          { text: doc.buyerName, alignment: "center", bold: true, fontSize: 15, margin: [0, 2, 0, 16] },
        ] as Content[])
      : []),
    ...(doc.solicitationNumber
      ? ([{ text: `Solicitation No. ${doc.solicitationNumber}`, alignment: "center", color: SLATE, fontSize: 11 }] as Content[])
      : []),
    ...(doc.dueDate
      ? ([{ text: `Due ${doc.dueDate}`, alignment: "center", color: SLATE, fontSize: 11 }] as Content[])
      : []),
    { canvas: [{ type: "line", x1: contentWidth / 2 - 60, y1: 0, x2: contentWidth / 2 + 60, y2: 0, lineWidth: 0.75, lineColor: BORDER }], margin: [0, 28, 0, 28] },
    { text: "Submitted by", alignment: "center", color: SLATE, fontSize: 10 },
    { text: doc.companyName, alignment: "center", bold: true, fontSize: 15, margin: [0, 2, 0, 6] },
    { text: doc.dateLabel, alignment: "center", color: SLATE, fontSize: 11 },
    {
      text: "This proposal contains confidential and proprietary information.",
      alignment: "center",
      italics: true,
      color: SLATE,
      fontSize: 9,
      absolutePosition: { x: MARGIN, y: doc.pageSize === "a4" ? 760 : 700 },
      width: contentWidth,
    } as Content,
  ];

  const contents: Content[] = [
    { text: "Contents", style: "h1", pageBreak: "before" },
    {
      toc: { numberStyle: { color: SLATE } },
      margin: [0, 6, 0, 0],
    } as Content,
  ];

  const sections: Content[] = doc.sections.flatMap((section) => [
    {
      text: section.number ? `${section.number}. ${section.title}` : section.title,
      style: "h1",
      pageBreak: "before",
      tocItem: true,
      tocStyle: { color: INK },
      tocMargin: [0, 4, 0, 0],
    } as Content,
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 1.2, lineColor: BRAND }],
      margin: [0, 0, 0, 14],
    },
    ...renderBlocks(
      section.blocks,
      { contentWidth, headingLevel: relativeHeadingLevel(section.blocks) },
      contentWidth,
    ),
  ]);

  return {
    pageSize: doc.pageSize === "a4" ? "A4" : "LETTER",
    pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN],
    info: {
      title: `${doc.rfpTitle} — Proposal`,
      author: doc.companyName,
      creator: doc.companyName,
    },
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.25, color: INK },
    styles: {
      h1: { fontSize: 18, bold: true, margin: [0, 0, 0, 6] },
      h2: { fontSize: 13.5, bold: true, color: BRAND, margin: [0, 10, 0, 5] },
      h3: { fontSize: 11.5, bold: true, margin: [0, 8, 0, 4] },
      h4: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 3] },
    },
    header: (currentPage) =>
      currentPage === 1
        ? ""
        : {
            text: `${doc.companyName}  |  ${doc.rfpTitle}`,
            alignment: "right",
            fontSize: 8,
            color: SLATE,
            margin: [MARGIN, 36, MARGIN, 0],
          },
    footer: (currentPage, pageCount) =>
      currentPage === 1
        ? ""
        : {
            text: `Page ${currentPage} of ${pageCount}`,
            alignment: "center",
            fontSize: 8,
            color: SLATE,
            margin: [MARGIN, 24, MARGIN, 0],
          },
    // Never leave a heading stranded at the bottom of a page.
    pageBreakBefore: (current, following) =>
      current.headlineLevel === 1 && following.length === 0,
    content: [...cover, ...contents, ...sections],
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
