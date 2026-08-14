import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";
import {
  DRAFT_SECTIONS,
  draftSectionLabel,
} from "@/lib/rfp-draft";
import type { Draft, DraftSection } from "@/lib/generated/prisma";

const INK = "0B1F33";
const BRAND = "0F6E5B";
const SLATE = "445566";
const BORDER = "E2E8E4";
const ACCENT = "E8A33D";
const SURFACE = "F6F8F7";

export type ProposalExportInput = {
  agencyName: string;
  rfpTitle: string;
  drafts: Draft[];
};

function plainParagraph(text: string, opts?: { spacingAfter?: number }) {
  return new Paragraph({
    spacing: { after: opts?.spacingAfter ?? 160, line: 276 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: 22,
        color: INK,
      }),
    ],
  });
}

function bulletParagraph(text: string) {
  return new Paragraph({
    spacing: { after: 80, line: 276 },
    indent: { left: convertInchesToTwip(0.25) },
    children: [
      new TextRun({
        text: `• ${text}`,
        font: "Calibri",
        size: 22,
        color: INK,
      }),
    ],
  });
}

function inlineRunsFromMarkdown(line: string): TextRun[] {
  // Lightweight **bold** support; strip other markdown noise.
  const cleaned = line
    .replace(/^#{1,6}\s+/, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  if (parts.length === 0) {
    return [new TextRun({ text: "", font: "Calibri", size: 22, color: INK })];
  }

  return parts.map((part) => {
    const bold = part.startsWith("**") && part.endsWith("**");
    const text = bold ? part.slice(2, -2) : part;
    return new TextRun({
      text,
      font: "Calibri",
      size: 22,
      color: INK,
      bold,
    });
  });
}

function markdownToBlocks(content: string): (Paragraph | Table)[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: (Paragraph | Table)[] = [];
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) {
      return;
    }
    const rows = tableRows.filter(
      (row) => !row.every((cell) => /^:?-+:?$/.test(cell.trim())),
    );
    if (rows.length > 0) {
      blocks.push(markdownTableToDocx(rows));
    }
    tableRows = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushTable();
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());
      tableRows.push(cells);
      continue;
    }

    flushTable();

    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = Math.min(trimmed.match(/^#+/)?.[0].length ?? 1, 3);
      const text = trimmed.replace(/^#{1,3}\s+/, "");
      blocks.push(
        new Paragraph({
          heading:
            level === 1
              ? HeadingLevel.HEADING_2
              : level === 2
                ? HeadingLevel.HEADING_3
                : HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 120 },
          children: [
            new TextRun({
              text,
              font: "Calibri",
              size: level === 1 ? 26 : 24,
              bold: true,
              color: BRAND,
            }),
          ],
        }),
      );
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      blocks.push(bulletParagraph(trimmed.replace(/^[-*•]\s+/, "")));
      continue;
    }

    blocks.push(
      new Paragraph({
        spacing: { after: 160, line: 276 },
        children: inlineRunsFromMarkdown(trimmed),
      }),
    );
  }

  flushTable();

  if (blocks.length === 0) {
    blocks.push(plainParagraph("(No content yet for this section.)"));
  }

  return blocks;
}

function markdownTableToDocx(rows: string[][]): Table {
  const colCount = Math.max(...rows.map((row) => row.length), 1);
  const columnWidth = Math.floor(9360 / colCount);

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: rows.map(
      (row, rowIndex) =>
        new TableRow({
          children: Array.from({ length: colCount }, (_, colIndex) => {
            const cellText = row[colIndex] ?? "";
            return new TableCell({
              width: { size: columnWidth, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
                left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
                right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
              },
              shading: {
                fill: rowIndex === 0 ? SURFACE : "FFFFFF",
              },
              children: [
                new Paragraph({
                  spacing: { before: 60, after: 60 },
                  children: [
                    new TextRun({
                      text: cellText,
                      font: "Calibri",
                      size: 20,
                      bold: rowIndex === 0,
                      color: rowIndex === 0 ? BRAND : INK,
                    }),
                  ],
                }),
              ],
            });
          }),
        }),
    ),
  });
}

function sectionContentMap(drafts: Draft[]) {
  const map = new Map<DraftSection, string>();
  for (const draft of drafts) {
    map.set(draft.sectionName, draft.content.trim());
  }
  return map;
}

function coverPage(agencyName: string, rfpTitle: string) {
  const today = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return [
    new Paragraph({
      spacing: { after: 0 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 24, color: BRAND, space: 1 },
      },
      children: [],
    }),
    new Paragraph({ spacing: { after: 400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 8, color: BORDER, space: 12 },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: BORDER, space: 12 },
        left: { style: BorderStyle.SINGLE, size: 8, color: BORDER, space: 12 },
        right: { style: BorderStyle.SINGLE, size: 8, color: BORDER, space: 12 },
      },
      children: [
        new TextRun({
          text: "  [ Agency logo ]  ",
          font: "Calibri",
          size: 20,
          color: SLATE,
          italics: true,
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 480 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: agencyName.toUpperCase(),
          font: "Calibri",
          size: 20,
          bold: true,
          color: BRAND,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: agencyName,
          font: "Calibri",
          size: 48,
          bold: true,
          color: INK,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "Technical & Commercial Proposal",
          font: "Calibri",
          size: 28,
          color: SLATE,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 },
      },
      children: [],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: rfpTitle,
          font: "Calibri",
          size: 32,
          bold: true,
          color: INK,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 40 },
      children: [
        new TextRun({
          text: "Prepared for response submission",
          font: "Calibri",
          size: 20,
          color: SLATE,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: today,
          font: "Calibri",
          size: 20,
          color: SLATE,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [
        new TextRun({
          text: "Confidential — for the intended recipient only",
          font: "Calibri",
          size: 18,
          italics: true,
          color: SLATE,
        }),
      ],
    }),
    new Paragraph({ children: [], pageBreakBefore: false }),
  ];
}

export function buildProposalDocument(input: ProposalExportInput) {
  const { agencyName, rfpTitle, drafts } = input;
  const bySection = sectionContentMap(drafts);

  const children: (Paragraph | Table)[] = [
    ...coverPage(agencyName, rfpTitle),
    new Paragraph({
      children: [],
      pageBreakBefore: true,
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "Proposal contents",
          font: "Calibri",
          size: 20,
          bold: true,
          color: BRAND,
        }),
      ],
    }),
  ];

  for (const section of DRAFT_SECTIONS) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: draftSectionLabel[section],
            font: "Calibri",
            size: 20,
            color: SLATE,
          }),
        ],
      }),
    );
  }

  for (const section of DRAFT_SECTIONS) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 240 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 12,
            color: BRAND,
            space: 8,
          },
        },
        children: [
          new TextRun({
            text: draftSectionLabel[section],
            font: "Calibri",
            size: 32,
            bold: true,
            color: INK,
          }),
        ],
      }),
      ...markdownToBlocks(bySection.get(section) ?? ""),
    );
  }

  return new Document({
    creator: "DraftWin",
    title: `${rfpTitle} — Proposal`,
    description: `Proposal draft generated for ${agencyName}`,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.9),
              bottom: convertInchesToTwip(0.9),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });
}

export async function buildProposalDocxBuffer(input: ProposalExportInput) {
  const document = buildProposalDocument(input);
  return Packer.toBuffer(document);
}

export function proposalExportFileName(rfpTitle: string) {
  const safe = rfpTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${safe || "proposal"}-draftwin.docx`;
}

export function draftsReadyForExport(drafts: Draft[]) {
  const bySection = sectionContentMap(drafts);
  return DRAFT_SECTIONS.every((section) => Boolean(bySection.get(section)));
}
