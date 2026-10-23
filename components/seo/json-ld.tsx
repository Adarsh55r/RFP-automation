/**
 * Structured data (schema.org JSON-LD) that tells search engines and AI
 * assistants what the page is about. `<` is escaped so text can never close
 * the script tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
