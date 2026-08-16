// source https://github.com/sindresorhus/html-tags/blob/master/html-tags.json
// with some random uncommon ones removed. note: we just use this to run the
// content through dompurify without escaping if we see an htmlTag from this
// list otherwise we escape angle brackets and things prematurely because it
// might be something like <TRA> in VCF. Ref #657
const htmlTags = [
  'a',
  'b',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'img',
  'li',
  'mark',
  'p',
  'pre',
  'span',
  'small',
  'strong',
  'table',
  'tbody',
  'sup',
  'sub',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]

// adapted from is-html
// https://github.com/sindresorhus/is-html/blob/master/index.js
const full = new RegExp(
  htmlTags.map(tag => String.raw`<${tag}\b[^>]*>`).join('|'),
  'i',
)

/**
 * Whether a string is markup to RENDER rather than text that merely contains
 * angle brackets — a VCF symbolic allele (`<DEL>`), an email in brackets, `a<b`.
 *
 * The one place that question is answered, because two callers answer it about
 * the same string and a disagreement is silent: `SanitizedHTML` escapes what
 * this rejects (so `<DEL>` reaches the screen intact), and anything extracting
 * that string's words for the clipboard has to make the same call or a parser
 * eats the allele the tooltip displayed.
 */
export function looksLikeHTML(str: string) {
  return full.test(str)
}

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Angle brackets and friends as entities, so text renders as itself. */
export function escapeHTML(str: string) {
  return str.replaceAll(/[&<>"']/g, c => htmlEscapes[c]!)
}
