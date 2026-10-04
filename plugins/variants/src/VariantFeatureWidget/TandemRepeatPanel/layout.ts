import type { RepeatAllele, RepeatUnit } from './tandemRepeat.ts'

// a run stating more copies than this draws as one box, so a corrupt count
// cannot allocate a box per copy
const MAX_COPIES = 50_000

export interface CopyBox {
  // bp from the allele's left end
  start: number
  bp: number
  unit: number
}

// Each copy an allele's runs state. RUB gives each copy's bases; without it a
// whole count splits its run evenly, and a fractional count takes whole units
// with the remainder last.
export function copiesOf(allele: RepeatAllele, units: RepeatUnit[]) {
  const boxes: CopyBox[] = []
  let at = 0
  for (const run of allele.runs ?? []) {
    if (run.count > MAX_COPIES) {
      boxes.push({ start: at, bp: run.bp, unit: run.unit })
      at += run.bp
      continue
    }
    const n = Math.ceil(run.count)
    const each = Number.isInteger(run.count)
      ? run.bp / n
      : (units[run.unit]?.length ?? run.bp / run.count)
    const lengths = (
      run.copyBp ??
      Array.from({ length: n }, (_, i) =>
        i < n - 1 ? each : run.bp - each * (n - 1),
      )
    ).map(bp => Math.max(0, bp))
    for (const bp of lengths) {
      boxes.push({ start: at, bp, unit: run.unit })
      at += bp
    }
  }
  return boxes
}

export interface CopyRun extends CopyBox {
  first: number
  count: number
  narrow: boolean
}

// Consecutive copies of one unit that each draw narrower than `minPx` merge into
// a single run, so an array of thousands of copies stays a handful of elements
export function mergeNarrowCopies(
  copies: CopyBox[],
  scale: number,
  minPx: number,
) {
  const runs: CopyRun[] = []
  copies.forEach((copy, i) => {
    const last = runs.at(-1)
    const narrow = copy.bp * scale < minPx
    if (last?.narrow && narrow && last.unit === copy.unit) {
      last.bp += copy.bp
      last.count++
    } else {
      runs.push({ ...copy, first: i, count: 1, narrow })
    }
  })
  return runs
}

export const ROW_PX = 22
export const BAR_PX = 12
const ROWS_MAX_PX = 30 * ROW_PX
const LABEL_MIN_PX = 11

// More rows than fit 30 full rows squash into their height, below a pixel if
// need be; rows too thin for a label draw unlabelled, their bars touching
export function rowLayout(rows: number) {
  const rowPx = Math.min(ROW_PX, ROWS_MAX_PX / Math.max(1, rows))
  const labelled = rowPx >= LABEL_MIN_PX
  return {
    rowPx,
    barPx: labelled ? (rowPx * BAR_PX) / ROW_PX : rowPx,
    labelled,
  }
}

export function copyCount(allele: RepeatAllele) {
  return allele.runs?.reduce((sum, run) => sum + run.count, 0)
}

export function formatBp(bp: number) {
  if (bp < 1000) {
    return `${Math.round(bp)} bp`
  }
  if (bp < 1_000_000) {
    return `${(bp / 1000).toFixed(bp < 10_000 ? 1 : 0)} kb`
  }
  return `${(bp / 1_000_000).toFixed(bp < 10_000_000 ? 1 : 0)} Mb`
}

function formatCount(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

// What the end of a bar says: its length, its copies where runs state them or
// its length in units for the reference allele, and its difference from the
// reference allele
export function readout(
  allele: RepeatAllele,
  referenceBp: number,
  unitLength: number | undefined,
) {
  const copies = copyCount(allele)
  const counted =
    copies !== undefined
      ? ` · ${formatCount(copies)} copies`
      : unitLength
        ? ` ≈ ${Math.round(allele.bp / unitLength)} units`
        : ''
  const delta = allele.bp - referenceBp
  const against =
    delta === 0 ? '' : ` (${delta > 0 ? '+' : '−'}${formatBp(Math.abs(delta))})`
  return `${formatBp(allele.bp)}${counted}${against}`
}

// Round positions for a ruler over [0, max]: steps of 1, 2 or 5 times a power
// of ten, about `target` of them.
export function axisTicks(max: number, target = 6) {
  if (!(max > 0)) {
    return [0]
  }
  const raw = max / target
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(
    1,
    [1, 2, 5, 10].map(m => m * power).find(s => s >= raw) ?? 10 * power,
  )
  const ticks: number[] = []
  for (let t = 0; t <= max; t += step) {
    ticks.push(t)
  }
  return ticks
}
