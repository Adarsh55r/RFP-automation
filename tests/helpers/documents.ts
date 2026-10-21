import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";

/** Builds a real .docx from plain text (one paragraph per line) plus an optional table. */
export async function makeDocx(text: string, table?: string[][]) {
  const children: (Paragraph | Table)[] = text.split("\n").map((line) => new Paragraph({ children: [new TextRun(line)] }));
  if (table) {
    children.push(
      new Table({
        rows: table.map((row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph(cell)] })) })),
      }),
    );
  }
  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

/** Builds a real PDF (two-column page + a table) with pdfmake's bundled fonts. */
export async function makePdf(text: string, table?: string[][], twoColumn?: [string, string]) {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const vfsModule = await import("pdfmake/build/vfs_fonts");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake: any = (pdfMakeModule as any).default ?? pdfMakeModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vfs: any = (vfsModule as any).default ?? vfsModule;
  pdfMake.vfs = vfs.pdfMake?.vfs ?? vfs.vfs ?? vfs;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = text.split("\n").map((line) => ({ text: line || " " }));
  if (twoColumn) content.push({ columns: [{ text: twoColumn[0] }, { text: twoColumn[1] }], columnGap: 20 });
  if (table) content.push({ table: { body: table } });
  return new Promise<Buffer>((resolve) => {
    pdfMake.createPdf({ content }).getBuffer((buffer: Uint8Array) => resolve(Buffer.from(buffer)));
  });
}
