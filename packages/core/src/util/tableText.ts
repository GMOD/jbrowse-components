const collator = new Intl.Collator(undefined, { numeric: true })

/** compares as a reader expects text to sort, `chr2` before `chr10` */
export function naturalOrder(a: string, b: string) {
  return collator.compare(a, b)
}

/**
 * a cell's value as plain text, which a table's search, its CSV export and a
 * cell's hover read: a number without separators, and nothing as ''
 */
export function cellText(value: unknown) {
  return value == null
    ? ''
    : typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? `${value}`
        : JSON.stringify(value)
}

function isBlank(value: unknown) {
  return value == null || value === ''
}

const plainNumber = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i

function asNumber(value: unknown) {
  return typeof value === 'number'
    ? value
    : typeof value === 'string' && plainNumber.test(value)
      ? Number(value)
      : undefined
}

function compareFilled(a: unknown, b: unknown) {
  const x = asNumber(a)
  const y = asNumber(b)
  return x !== undefined && y !== undefined
    ? x - y
    : naturalOrder(cellText(a), cellText(b))
}

/**
 * a blank sorts last whichever way the column sorts; two numbers, or two
 * strings that are plain numbers, compare by value
 */
export function compareValues(a: unknown, b: unknown, direction: number) {
  return isBlank(a)
    ? isBlank(b)
      ? 0
      : 1
    : isBlank(b)
      ? -1
      : direction * compareFilled(a, b)
}

const formulaStart = /^[=+\-@\t\r]/
const loneSign = /^[-+]$/

function csvField(text: string) {
  return formulaStart.test(text) &&
    !plainNumber.test(text) &&
    !loneSign.test(text)
    ? `"'${text.replaceAll('"', '""')}"`
    : /[",\r\n]/.test(text)
      ? `"${text.replaceAll('"', '""')}"`
      : text
}

/**
 * one CSV line. A field a spreadsheet would read as a formula is quoted with a
 * leading `'`, a number with its sign is left alone.
 */
export function csvLine(fields: string[]) {
  return fields.map(csvField).join(',')
}

/** a header line and one line per row, CRLF-separated */
export function csvText(headers: string[], rows: string[][]) {
  return [csvLine(headers), ...rows.map(csvLine)].join('\r\n')
}

/** a search box's words, lowercased; a row matches when it holds each one */
export function splitSearchWords(text: string) {
  return text.toLowerCase().split(/\s+/).filter(Boolean)
}

function escapeRegExp(text: string) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** what a table highlights for `splitSearchWords`, case-insensitively */
export function searchHighlightPatterns(words: string[]) {
  return words.map(word => new RegExp(escapeRegExp(word), 'giu'))
}
