/**
 * The feature fields these writers spend on a column of their own — position,
 * identity, a link to a parent — and therefore do not repeat as an
 * attribute/qualifier. GenBank adds `name`, which GFF3 keeps so it can retitle
 * it to `Name`.
 */
export const coreFeatureFields = new Set([
  'uniqueId',
  'id',
  'refName',
  'source',
  'type',
  'start',
  'end',
  'strand',
  'parent',
  'parentId',
  'score',
  'subfeatures',
  'phase',
])

/**
 * Column 6 of BED and column 7 of GFF3 are the same three tokens over the same
 * 1/-1/0 a feature carries, so the convention gets one definition.
 */
export function formatStrand(strand: number | undefined) {
  return strand === 1 ? '+' : strand === -1 ? '-' : '.'
}

/**
 * Render an attribute value: an array joins on a comma, an object goes through
 * JSON, anything else stringifies. Returns undefined for a value with nothing
 * in it, so a caller can drop the attribute rather than write it empty.
 *
 * `encode` is the format's escaping, applied to each leaf — GFF3
 * percent-encodes its delimiters, GenBank doubles quotes instead.
 */
export function formatAttributeValue(
  obj: unknown,
  encode: (str: string) => string = str => str,
): string | undefined {
  if (obj === null || obj === undefined) {
    return undefined
  }
  if (Array.isArray(obj)) {
    const items = obj
      .map(o => formatAttributeValue(o, encode))
      .filter(o => o !== undefined)
    return items.length > 0 ? items.join(',') : undefined
  }
  if (typeof obj === 'object') {
    return encode(JSON.stringify(obj))
  }
  return encode(String(obj))
}
