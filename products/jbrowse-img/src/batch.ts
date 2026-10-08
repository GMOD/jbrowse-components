import type {
  VariantAllele,
  VariantSortColumn,
} from '@jbrowse/alignments-core/variantSortColumn'

// Batch rendering: one image per record of a callset, so reviewing it is a
// directory of pictures rather than N trips through the browser. BEDPE is the
// interchange format a LINX or GRIDSS TSV converts to; `vcfJunctions.ts` reads
// the VCF every caller writes.

/** 0-based half-open, as BEDPE writes an end */
export interface Locus {
  refName: string
  start: number
  end: number
}

/**
 * One image of a run and the loci it is drawn on: two for a junction, one for a
 * record naming no other end (an insertion, a single breakend), every locus of
 * its records for a caller's event.
 */
export interface BatchRecord {
  loci: Locus[]
  name?: string
  /** 1-based line of the input file; an event, read from many, has none */
  line?: number
  /** VCF's `EVENT`: the rearrangement the caller filed the record under */
  event?: string
  /** the pileup column a record spelling out its alleles is sorted at */
  sort?: VariantSortColumn
  /** the longest of that record's REF and ALTs, in bases */
  alleleLength?: number
  /** what a read carrying the record's ALT has at `sort` */
  carried?: CarriedCall
}

/**
 * A base, `*` for a deleted one, or an insertion of at least `minInsertion`
 * bases: half the ALT's own, because a long read's copy of an insertion is
 * rarely the caller's length to the base. `anywhere` counts that insertion
 * wherever it sits in the image, for one of structural-variant size.
 */
export type CarriedCall =
  | { base: string }
  | { minInsertion: number; anywhere: boolean }

/** A record's `carried`, as the count is asked for at its flank */
export function recordAllele(
  rec: BatchRecord,
  flank?: number,
): VariantAllele | undefined {
  const { carried } = rec
  return carried && 'minInsertion' in carried
    ? {
        minInsertion: carried.minInsertion,
        within: carried.anywhere ? recordFlank(rec, flank) : 0,
      }
    : carried
}

function parseLocus(refName?: string, start?: string, end?: string) {
  const s = Number(start)
  const e = Number(end)
  return refName && Number.isFinite(s) && Number.isFinite(e) && s >= 0 && e >= 0
    ? { refName, start: s, end: e }
    : undefined
}

/**
 * Parse a BEDPE. Blank lines, `#` comments and `track`/`browser` lines are
 * skipped. A row whose second end is the BEDPE null marker (`.`, `-1`, `-1`) is
 * a single breakend and keeps its one locus; a row with no usable first end is
 * reported, so a run that produced 380 images from a 400-row file says why.
 */
export function parseBedpe(text: string) {
  const records: BatchRecord[] = []
  const skipped: string[] = []
  let lineNo = 0
  for (const rawLine of text.split('\n')) {
    lineNo++
    const line = rawLine.trim()
    if (
      !line ||
      line.startsWith('#') ||
      line.startsWith('track') ||
      line.startsWith('browser')
    ) {
      continue
    }
    const f = line.split('\t')
    if (f.length < 6) {
      skipped.push(`line ${lineNo}: needs 6 columns, got ${f.length}`)
      continue
    }
    const [refName1, s1, e1, refName2, s2, e2, name] = f
    const own = parseLocus(refName1, s1, e1)
    const mate = parseLocus(refName2, s2, e2)
    const mateIsNull = refName2 === '.' || (s2 === '-1' && e2 === '-1')
    if (!own || (!mate && !mateIsNull)) {
      skipped.push(`line ${lineNo}: no usable coordinates`)
      continue
    }
    records.push({
      loci: mate ? [own, mate] : [own],
      line: lineNo,
      ...(name && name !== '.' ? { name } : {}),
    })
  }
  return { records, skipped }
}

// The size below which callers file an indel as a small variant
export const SMALL_VARIANT_BP = 50

/**
 * `--flank`, or the context the record is read at: 50 bp for a variant whose
 * alleles are short enough to read base by base, 500 bp for a junction, where
 * what matters is the reads leaving it.
 */
export function recordFlank(rec: BatchRecord, flank?: number) {
  return (
    flank ??
    (rec.alleleLength !== undefined && rec.alleleLength < SMALL_VARIANT_BP
      ? 50
      : 500)
  )
}

// Past this a window is too narrow to read its pileup, and the row wraps
const ROW_MAX_WINDOWS = 4

/**
 * The rows an image is drawn in, each the windows of one contig left to right.
 * Every locus grows by the record's flank on each side, and windows of one
 * contig that overlap draw as the one span they cover: a breakend is one base,
 * so the flank decides the picture, and a deletion shorter than it would
 * otherwise render the same reads twice. Contigs keep the order the record
 * names them in, and a contig of more than four windows wraps.
 */
export function recordRows(rec: BatchRecord, flankOpt?: number) {
  const flank = recordFlank(rec, flankOpt)
  const byContig = new Map<string, Locus[]>()
  for (const { refName, start, end } of rec.loci) {
    const lo = Math.max(0, start - flank)
    const hi = end + flank
    const windows = byContig.get(refName) ?? []
    byContig.set(refName, windows)
    const overlapping = windows.find(w => lo <= w.end && w.start <= hi)
    if (overlapping) {
      overlapping.start = Math.min(overlapping.start, lo)
      overlapping.end = Math.max(overlapping.end, hi)
    } else {
      windows.push({ refName, start: lo, end: hi })
    }
  }
  return [...byContig.values()].flatMap(windows => {
    const locs = windows
      .sort((a, b) => a.start - b.start)
      .map(w => `${w.refName}:${w.start + 1}-${w.end}`)
    return Array.from(
      { length: Math.ceil(locs.length / ROW_MAX_WINDOWS) },
      (_, row) =>
        locs.slice(row * ROW_MAX_WINDOWS, (row + 1) * ROW_MAX_WINDOWS),
    )
  })
}

/**
 * A filename for one record, unique within the run: the index first, zero
 * padded, so the directory sorts in callset order; then the coordinates,
 * because a caller's id (`SV_20`) says nothing about where a call is; then the
 * id. The whole basename is sanitized, since a refName like `GL000/1` is no
 * safer in a path than a caller's label.
 */
export function outputName(
  rec: BatchRecord,
  idx: number,
  total: number,
  ext: string,
) {
  const num = String(idx + 1).padStart(String(total).length, '0')
  const where = rec.loci.map(l => `${l.refName}_${l.start}`).join('-')
  const label = rec.name ? `_${rec.name}` : ''
  return `${`${num}_${where}${label}`.replaceAll(/[^\w.-]+/g, '-')}.${ext}`
}

/**
 * One record per caller's event, holding every locus its records name, in
 * `refNameOrder` then by position, so its panels read in genome order.
 */
export function eventRecords(records: BatchRecord[], refNameOrder: string[]) {
  const rank = new Map(refNameOrder.map((refName, i) => [refName, i]))
  const lociByEvent = new Map<string, Locus[]>()
  for (const { event, loci } of records) {
    if (event !== undefined) {
      lociByEvent.set(event, [...(lociByEvent.get(event) ?? []), ...loci])
    }
  }
  return [...lociByEvent].map(([event, loci]): BatchRecord => ({
    event,
    name: event,
    loci: loci.sort(
      (a, b) =>
        (rank.get(a.refName) ?? Infinity) - (rank.get(b.refName) ?? Infinity) ||
        a.refName.localeCompare(b.refName) ||
        a.start - b.start,
    ),
  }))
}

/** Sorts after every record's image, which opens with a digit. */
export function eventOutputName(
  rec: BatchRecord,
  idx: number,
  total: number,
  ext: string,
) {
  const num = String(idx + 1).padStart(String(total).length, '0')
  return `${`event_${num}_${rec.name}`.replaceAll(/[^\w.-]+/g, '-')}.${ext}`
}

/**
 * The reference bases a record changes, from its sort column to the end of its
 * REF or to its other end on the contig: the band that marks the call on an
 * image of one window.
 */
export function recordHighlight(rec: BatchRecord) {
  const [locus] = rec.loci
  return rec.sort && locus
    ? {
        refName: locus.refName,
        start: rec.sort.pos,
        end: Math.max(
          rec.sort.pos + 1,
          ...rec.loci.filter(l => l.refName === locus.refName).map(l => l.end),
        ),
      }
    : undefined
}
