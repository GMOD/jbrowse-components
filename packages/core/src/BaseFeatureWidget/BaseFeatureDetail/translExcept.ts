/**
 * INSDC's `/transl_except`, a codon read as an amino acid other than the
 * genetic code's: `(pos:<location>,aa:<amino acid>)`. The location is a base
 * range, a single base (a partial stop codon), a `join` of ranges (a codon
 * split by an intron), or any of these inside `complement`. A `<` or `>`
 * marks a partial end and is dropped.
 */
export interface TranslExcept {
  /** 1-based, inclusive, in the order the location lists them */
  ranges: { start: number; end: number }[]
  strand: 1 | -1
  aa: string
}

const rangePattern = /^<?(\d+)(?:\.\.>?(\d+))?$/

function parseRange(text: string) {
  const match = rangePattern.exec(text.trim())
  const start = Number(match?.[1])
  const end = match?.[2] === undefined ? start : Number(match[2])
  return match && start <= end ? { start, end } : undefined
}

function parseLocation(
  text: string,
): Pick<TranslExcept, 'ranges' | 'strand'> | undefined {
  const complement = /^complement\((.+)\)$/.exec(text)
  const join = /^join\((.+)\)$/.exec(text)
  const inner = complement
    ? parseLocation(complement[1]!)
    : join
      ? { ranges: join[1]!.split(',').map(parseRange), strand: 1 as const }
      : { ranges: [parseRange(text)], strand: 1 as const }
  const ranges = inner?.ranges.flatMap(range => (range ? [range] : []))
  return inner && ranges?.length === inner.ranges.length
    ? {
        ranges,
        strand: complement ? (inner.strand === 1 ? -1 : 1) : inner.strand,
      }
    : undefined
}

const itemPattern = /\(pos:(.+?),aa:([^)]+)\)/g

/**
 * Every exception a `transl_except` value states, or undefined when any part
 * of it does not read as one. A GFF3 attribute holding an unescaped comma
 * arrives split into an array, so the parts are joined back first.
 */
export function parseTranslExcept(value: unknown) {
  const text = (Array.isArray(value) ? value.join(',') : String(value)).trim()
  const matches = [...text.matchAll(itemPattern)]
  const leftover = text.replaceAll(itemPattern, '').replaceAll(/[\s,]/g, '')
  const items = matches.map(([, pos, aa]) => {
    const location = parseLocation(pos!.replaceAll(/\s/g, ''))
    return location ? { ...location, aa: aa!.trim() } : undefined
  })
  const parsed = items.flatMap(item => (item ? [item] : []))
  return matches.length > 0 && leftover === '' && parsed.length === items.length
    ? parsed
    : undefined
}
