/**
 * Label parsing utilities.
 * Handles quoted strings, \n, <br/>, markdown strings, and HTML entities.
 */

/** Strip wrapping single or double quotes */
export function stripQuotes(text: string): string {
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

/** Detect and unwrap markdown string syntax: "`...`" */
export function unwrapMarkdownString(text: string): {
  text: string;
  isMarkdown: boolean;
} {
  const trimmed = text.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return { text: trimmed.slice(1, -1), isMarkdown: true };
  }
  return { text: trimmed, isMarkdown: false };
}

/** Strip markdown bold/italic markers, preserving the text */
export function stripMarkdownFormatting(text: string): string {
  // **bold** → bold
  text = text.replace(/\*\*(.+?)\*\*/g, "$1");
  // *italic* or _italic_ → italic
  text = text.replace(/\*(.+?)\*/g, "$1");
  text = text.replace(/_(.+?)_/g, "$1");
  return text;
}

/** Replace \n and <br/> variants with actual newlines */
export function normalizeLineBreaks(text: string): string {
  // Literal \n in the string
  text = text.replace(/\\n/g, "\n");
  // HTML <br>, <br/>, <br />
  text = text.replace(/<br\s*\/?>/gi, "\n");
  return text;
}

/** Decode common HTML entities: #quot; #amp; #9829; etc. */
export function decodeHTMLEntities(text: string): string {
  // Named entities
  text = text.replace(/#quot;/g, '"');
  text = text.replace(/#amp;/g, "&");
  text = text.replace(/#lt;/g, "<");
  text = text.replace(/#gt;/g, ">");

  // Decimal character codes: #1234;
  text = text.replace(/#(\d+);/g, (_match, code) =>
    String.fromCharCode(parseInt(code, 10))
  );

  return text;
}

/**
 * Full label processing pipeline.
 * Takes raw Mermaid label text and returns clean display text.
 */
export function processLabel(raw: string): string {
  let text = raw.trim();

  // Strip outer quotes
  text = stripQuotes(text);

  // Unwrap markdown string syntax
  const md = unwrapMarkdownString(text);
  text = md.text;

  // Strip markdown formatting (v1: plain text only)
  if (md.isMarkdown) {
    text = stripMarkdownFormatting(text);
  }

  // Normalize line breaks
  text = normalizeLineBreaks(text);

  // Decode HTML entities
  text = decodeHTMLEntities(text);

  return text.trim();
}
