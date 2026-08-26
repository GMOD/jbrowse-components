import { getLengthOnRef } from '@jbrowse/cigar-utils'

import type { SamHeaderLine } from '../shared/util.ts'

/**
 * One SAM alignment line, decoded into the field names the alignments render
 * path reads. Unset optional fields (`*`/0 in the file) are left undefined
 * rather than carrying a sentinel, so `get()` reports them as absent the way
 * BAM/CRAM do.
 */
export interface SamRecordData {
  name: string
  flags: number
  refName: string
  start: number
  end: number
  mapq: number
  CIGAR: string
  next_ref?: string
  next_pos?: number
  template_length: number
  seq: string
  qual?: Uint8Array
  tags: Record<string, string | number>
}

// A tag reads `TAG:TYPE:VALUE`. i/f are numbers; A/Z/H stay strings.
//
// A `B` array opens its value with a subtype letter — `ML:B:C,251,0,128` — and
// that letter is not data. Consumers read the comma-joined list and coerce each
// element (`getModProbabilityBytes` names SAM text as one of its two inputs), so
// a leading `C,` parsed as a NaN element: every ML probability landed one call
// late and the last was dropped, silently, on every read of a SAM track.
function parseTag(field: string) {
  const tag = field.slice(0, 2)
  const type = field[3]
  if (type === 'B') {
    return { tag, value: field.slice(7) } as const
  }
  const value = field.slice(5)
  return {
    tag,
    value: type === 'i' || type === 'f' ? Number(value) : value,
  } as const
}

// Phred scores off the ASCII-33 QUAL column. '*' means unavailable, which the
// per-base-quality color mode must see as absent rather than as a run of zeros.
function parseQual(field: string) {
  if (field === '*') {
    return undefined
  }
  const out = new Uint8Array(field.length)
  for (let i = 0; i < field.length; i++) {
    out[i] = field.charCodeAt(i) - 33
  }
  return out
}

/**
 * Parse one alignment line. Columns are positional through TLEN; everything
 * from column 12 on is an optional tag.
 */
export function parseSamLine(line: string): SamRecordData {
  const cols = line.split('\t')
  const [
    name = '',
    flags = '0',
    refName = '*',
    pos = '0',
    mapq = '255',
    cigar = '*',
    nextRef = '*',
    nextPos = '0',
    templateLength = '0',
    seq = '*',
    qual = '*',
  ] = cols

  const tags: Record<string, string | number> = {}
  for (let i = 11; i < cols.length; i++) {
    const { tag, value } = parseTag(cols[i]!)
    tags[tag] = value
  }

  const start = Number(pos) - 1
  const bases = seq === '*' ? '' : seq
  // An unmapped or CIGAR-less record still needs a nonzero span to be findable
  // by an interval-tree search, so it falls back to its own read length.
  const lengthOnRef =
    cigar === '*' ? bases.length : getLengthOnRef(cigar) || bases.length

  return {
    name,
    flags: Number(flags),
    refName,
    start,
    end: start + Math.max(lengthOnRef, 1),
    mapq: Number(mapq),
    CIGAR: cigar === '*' ? '' : cigar,
    next_ref: nextRef === '*' ? undefined : nextRef === '=' ? refName : nextRef,
    next_pos: nextPos === '0' ? undefined : Number(nextPos) - 1,
    template_length: Number(templateLength),
    seq: bases,
    qual: parseQual(qual),
    tags,
  }
}

/**
 * Decode an `@`-prefixed header line into the tag/value shape
 * {@link parseSamHeader} consumes, so a text header and a BAM/CRAM binary
 * header resolve refNames and read groups through the same code.
 */
export function parseSamHeaderLine(line: string): SamHeaderLine {
  const [tag = '', ...rest] = line.slice(1).split('\t')
  return {
    tag,
    data: rest.map(field => {
      // an @CO comment is free text with no tag:value structure
      const colon = field.indexOf(':')
      return colon === -1
        ? { tag: field, value: '' }
        : { tag: field.slice(0, colon), value: field.slice(colon + 1) }
    }),
  }
}
