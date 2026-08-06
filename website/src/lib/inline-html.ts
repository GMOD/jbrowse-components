// The small HTML-string layer the markdown pipeline works in: reading the
// attributes off a `<Figure … />` / `<Video … />` tag, and escaping text back
// into the raw HTML those plugins emit (rehype-raw parses that string, so a
// literal `<DEL>` in a caption would otherwise become an element).
//
// Both halves had three or four verbatim copies before this. The escape pair is
// deliberately two functions rather than one: a caption goes into element text,
// while an `alt=` or `href=` goes inside double quotes and needs `"` closed off
// as well. Reaching for the wrong one is safe in the strict direction only.

const ATTR_RE = /(\w+)=(?:"([^"]*)"|'([^']*)')/g

// Attributes of a JSX-ish self-closing tag, as written in the docs markdown.
// Values may be single- or double-quoted; a bare attribute is not supported
// (nothing in the docs writes one).
export function parseAttrs(str: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  ATTR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR_RE.exec(str)) !== null) {
    attrs[m[1]!] = m[2] ?? m[3] ?? ''
  }
  return attrs
}

// For element text content.
export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

// For a double-quoted attribute value. Also what an XML feed wants: these are
// the four predefined entities, and `'` only needs escaping inside a
// single-quoted attribute, which nothing here emits.
export function escapeAttr(s: string): string {
  return escapeHtml(s).replaceAll('"', '&quot;')
}
