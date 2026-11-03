import type {
  VariantAllele,
  VariantSortColumn,
} from '@jbrowse/alignments-core/variantSortColumn'

/** 0-based half-open, as BEDPE writes an end */
export interface Locus {
  refName: string
  start: number
  end: number
}

export interface BatchRecord {
  loci: Locus[]
  name?: string
  /** 1-based; an event has none */
  line?: number
  /** VCF's `EVENT` */
  event?: string
  sort?: VariantSortColumn
  /** the longest of the REF and ALTs, in bases */
  alleleLength?: number
  carried?: CarriedCall
}

/**
 * `*` is a deleted base. The size minimums are half the call's own, since a
 * long read rarely matches the caller's length to the base.
 */
export type CarriedCall =
  | { base: string; minDeletion?: number }
  | { minInsertion: number; anywhere: boolean }

export function recordAllele(rec: BatchRecord): VariantAllele | undefined {
  const { carried } = rec
  return carried && 'minInsertion' in carried
    ? { minInsertion: carried.minInsertion }
    : carried
}

// An `anywhere` insertion sorts across the flank, so every counted read lifts
export function recordSortColumn(
  rec: BatchRecord,
  flank?: number,
): VariantSortColumn | undefined {
  const { sort, carried } = rec
  return sort && carried && 'anywhere' in carried && carried.anywhere
    ? { ...sort, within: recordFlank(rec, flank) }
    : sort
}

function parseLocus(refName?: string, start?: string, end?: string) {
  const s = Number(start)
  const e = Number(end)
  return refName && Number.isFinite(s) && Number.isFinite(e) && s >= 0 && e >= 0
    ? { refName, start: s, end: e }
    : undefined
}

// A second end of `.` or `-1 -1` is a single breakend
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

// Overlapping windows merge, or a deletion shorter than the flank would draw
// the same reads twice.
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

// A refName like `GL000/1` needs sanitizing as much as a caller's label
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
