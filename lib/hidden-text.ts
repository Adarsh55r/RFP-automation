import JSZip from "jszip";

/**
 * Text a human reader would not see (hidden formatting, white or microscopic
 * text, text placed off the page) is a common way to plant instructions for
 * AI tools in a document. It is found here, removed before the AI reads the
 * document, and reported to the user. Detection is best effort: PDF text
 * colour is not exposed by the parser, so white text in a PDF is not caught.
 */

/** Hidden passages shorter than this are left alone (stray characters, page furniture). */
const MIN_HIDDEN_CHARS = 12;

function decodeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function isHiddenRun(properties: string) {
  const vanish = /<w:(vanish|specVanish)(?:\s+w:val="(?:true|1|on)")?\s*\/>/.test(properties);
  const white = /<w:color\b[^>]*w:val="(?:FFFFFF|ffffff)"/.test(properties) && !/<w:(shd|highlight)\b/.test(properties);
  const size = /<w:sz\b[^>]*w:val="(\d+)"/.exec(properties);
  // w:sz is in half-points: 3 or less is 1.5 pt or smaller.
  const tiny = size !== null && Number(size[1]) <= 3;
  return vanish || white || tiny;
}

/** Hidden passages in a Word document's body, headers and footers. */
export async function docxHiddenText(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const parts = Object.keys(zip.files).filter((name) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(name));
  const hidden: string[] = [];
  for (const name of parts) {
    const xml = (await zip.file(name)?.async("string")) ?? "";
    for (const paragraph of xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []) {
      let run = "";
      for (const match of paragraph.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
        const properties = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(match[1])?.[1] ?? "";
        const text = [...match[1].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((t) => decodeXml(t[1])).join("");
        if (isHiddenRun(properties)) run += text;
        else if (run) {
          hidden.push(run);
          run = "";
        }
      }
      if (run) hidden.push(run);
    }
  }
  return hidden.map((text) => text.replace(/\s+/g, " ").trim()).filter((text) => text.length >= MIN_HIDDEN_CHARS);
}

type PdfTextItem = { str?: string; transform?: number[] } | object;
type PdfPage = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
};

/** Microscopic or off-page text on PDF pages (text colour is not available from the parser). */
export async function pdfHiddenText(pdf: { numPages: number; getPage: (n: number) => Promise<PdfPage> }) {
  const hidden: string[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const { width, height } = page.getViewport({ scale: 1 });
    let run = "";
    for (const raw of (await page.getTextContent()).items) {
      // Marked-content entries have no text or position.
      const item = raw as { str?: string; transform?: number[] };
      const [a = 0, b = 0, , , x = 0, y = 0] = item.transform ?? [];
      const size = Math.hypot(a, b);
      const offPage = x < -5 || y < -5 || x > width + 5 || y > height + 5;
      if (item.str && (size < 1.5 || offPage)) run += `${item.str} `;
      else if (run) {
        hidden.push(run);
        run = "";
      }
    }
    if (run) hidden.push(run);
  }
  return hidden.map((text) => text.replace(/\s+/g, " ").trim()).filter((text) => text.length >= MIN_HIDDEN_CHARS);
}

/** Removes hidden passages from extracted text (whitespace-insensitive). */
export function removeHidden(text: string, hidden: string[]) {
  let out = text;
  for (const passage of hidden) {
    const pattern = passage
      .split(" ")
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s*");
    out = out.replace(new RegExp(pattern, "g"), " ");
  }
  return out;
}

const AI_DIRECTED =
  /ignore (all |any )?(previous|prior|above) (instructions|prompts)|disregard (the|all|your) (instructions|rules)|you are (an? )?(ai|language model|chatgpt|assistant)|note to (ai|llm|chatgpt|the model)|system prompt|<\/?(system|assistant|instructions?)>|as an ai (model|assistant)|include the (full |entire )?contents? of (the )?(other|all|any|previous) (documents?|files?|customers?)|(write|state|say|claim) that (we|you|the (bidder|vendor|supplier|contractor)) (hold|holds|have|has|are|is) /i;

/** Visible text addressed to AI tools. It stays in the document (it is the buyer's text) but the user is told. */
export function aiDirectedText(text: string) {
  const match = AI_DIRECTED.exec(text);
  if (!match) return null;
  const start = Math.max(0, match.index - 40);
  return text.slice(start, match.index + 120).replace(/\s+/g, " ").trim();
}

export function hiddenTextFlags(hidden: string[], documentText: string) {
  const flags: string[] = [];
  if (hidden.length > 0) {
    const sample = hidden[0].length > 100 ? `${hidden[0].slice(0, 100)}…` : hidden[0];
    flags.push(
      `Hidden text: ${hidden.length} passage${hidden.length === 1 ? "" : "s"} in this document ${hidden.length === 1 ? "is" : "are"} invisible to readers (hidden, white, microscopic or off-page text), for example “${sample}”. ${hidden.length === 1 ? "It was" : "They were"} removed before the AI read the document. Check the original if this text matters.`,
    );
  }
  const directed = aiDirectedText(documentText);
  if (directed) {
    flags.push(
      `Text aimed at AI tools: the document contains “${directed}”. DraftBid AI treats document text as data and does not follow it, but check what the buyer intended.`,
    );
  }
  return flags;
}
