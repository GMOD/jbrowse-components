import type { Entry } from './parseArgv.ts'

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

/**
 * The window each panel opens on: every locus grown by `flank` on each side, in
 * file order, with windows of one contig that overlap drawn as the one span
 * they cover. A breakend is one base, so the flank decides the picture, and a
 * deletion shorter than it would otherwise render the same reads twice.
 */
export function recordLocs(rec: BatchRecord, flank: number) {
  const windows: Locus[] = []
  for (const { refName, start, end } of rec.loci) {
    const lo = Math.max(0, start - flank)
    const hi = end + flank
    const overlapping = windows.find(
      w => w.refName === refName && lo <= w.end && w.start <= hi,
    )
    if (overlapping) {
      overlapping.start = Math.min(overlapping.start, lo)
      overlapping.end = Math.max(overlapping.end, hi)
    } else {
      windows.push({ refName, start: lo, end: hi })
    }
  }
  return windows.map(w => `${w.refName}:${w.start + 1}-${w.end}`)
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

/** The argv entries one record contributes: a `--loc` per panel. */
export function recordArgv(rec: BatchRecord, flank: number): Entry[] {
  return recordLocs(rec, flank).map(loc => ['loc', [loc]])
}
