import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { sampleColorRamp } from '@jbrowse/core/util/colorRamp'

import { DASH, LOWER_BIT, N_UPPER, SPACE } from '../util/asciiBytes.ts'

import type { MafBlock, MafIdentityBars } from './mafRenderingBackendTypes.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorRampStop } from '@jbrowse/core/util/colorRamp'
import type { SpanChannels } from '@jbrowse/render-core/marks'

/** How the identity plot draws: a ramp per cell, or a bar per cell. */
export type IdentityPlot = 'heatmap' | 'xyplot'

/**
 * Identity is quantized to hundredths: the ramp's steps, and finer than a row
 * band's bar height can show.
 */
const STEPS = 100

const IDENTITY_STOPS: readonly ColorRampStop[] = [
  [199, 67, 56, 255],
  [140, 140, 140, 255],
  [47, 102, 176, 255],
]

/**
 * Divergent red (0) through a grey neutral (0.5) to conserved blue (1). The
 * grey middle keeps low identity visible where a white one would vanish.
 */
export function identityColor(t: number): [number, number, number] {
  const [r, g, b] = sampleColorRamp(IDENTITY_STOPS, t)
  return [r, g, b]
}

export function identityRgb(t: number) {
  const [r, g, b] = identityColor(t)
  return `rgb(${r},${g},${b})`
}

const IDENTITY_ABGR = Uint32Array.from({ length: STEPS + 1 }, (_, i) =>
  cssColorToABGR(identityRgb(i / STEPS)),
)

const XYPLOT_BAR_RGB = identityRgb(1)
const XYPLOT_BAR_ABGR = IDENTITY_ABGR[STEPS]!

/**
 * The key for whichever identity plot draws: the ramp, or the X-Y plot's one
 * bar colour with its height named.
 */
export function identityColorScale(mode: IdentityPlot): ColorScale {
  const title = 'Per-base identity to reference'
  return mode === 'xyplot'
    ? {
        kind: 'categorical',
        id: mode,
        title,
        entries: [
          {
            value: 'bar',
            label: 'Bar height: full = conserved, flat = divergent',
            color: XYPLOT_BAR_RGB,
          },
        ],
      }
    : {
        kind: 'ramp',
        id: mode,
        title,
        domain: [0, 1],
        stops: [0, 0.5, 1].map(offset => ({
          offset,
          color: identityRgb(offset),
        })),
        format: v => `${Math.round(v * 100)}%`,
      }
}

/** Each row's mean identity to the reference, as runs of one hundredth. */
export interface MafIdentityRuns {
  x: Uint32Array
  x2: Uint32Array
  row: Uint32Array
  /** mean identity in hundredths */
  step: Uint8Array
  count: number
}

function capacity(blocks: readonly MafBlock[], binBp: number) {
  let total = 0
  for (const block of blocks) {
    total +=
      (Math.ceil((block.endBp - block.startBp) / binBp) + 1) * block.rows.length
  }
  return total
}

function rowCount(blocks: readonly MafBlock[]) {
  let n = 0
  for (const block of blocks) {
    for (const row of block.rows) {
      n = Math.max(n, row.rowIndex + 1)
    }
  }
  return n
}

/**
 * Each row's mean identity to the reference over absolute windows of `binBp`,
 * adjacent windows of one hundredth merged into a run. A window averages every
 * base in it, where the cells sample one, since a mean needs its whole
 * sample. A base is classifiable where the reference has a base other than
 * `N` and the row has a base; a window spans the bases it classified, so an
 * unaligned stretch paints nothing.
 */
export function buildIdentityRuns(
  blocks: readonly MafBlock[],
  binBp: number,
): MafIdentityRuns {
  const cap = capacity(blocks, binBp)
  const x = new Uint32Array(cap)
  const x2 = new Uint32Array(cap)
  const row = new Uint32Array(cap)
  const step = new Uint8Array(cap)
  let count = 0

  const n = rowCount(blocks)
  const bin = new Float64Array(n).fill(-1)
  const binLo = new Float64Array(n)
  const binHi = new Float64Array(n)
  const matches = new Uint32Array(n)
  const classified = new Uint32Array(n)
  const runLo = new Float64Array(n)
  const runHi = new Float64Array(n)
  const runStep = new Int16Array(n).fill(-1)

  function emitRun(r: number) {
    if (runStep[r]! >= 0) {
      x[count] = runLo[r]!
      x2[count] = runHi[r]!
      row[count] = r
      step[count] = runStep[r]!
      count++
      runStep[r] = -1
    }
  }

  function closeBin(r: number) {
    const c = classified[r]!
    if (c > 0) {
      const s = Math.round((matches[r]! * STEPS) / c)
      const lo = binLo[r]!
      const hi = binHi[r]! + 1
      if (runStep[r] === s && runHi[r] === lo) {
        runHi[r] = hi
      } else {
        emitRun(r)
        runLo[r] = lo
        runHi[r] = hi
        runStep[r] = s
      }
      matches[r] = 0
      classified[r] = 0
    }
  }

  for (const block of blocks) {
    const ref = block.refSeqBytes
    for (const { rowIndex: r, alignmentBytes: aln } of block.rows) {
      const len = Math.min(aln.length, ref.length)
      let bp = block.startBp
      for (let col = 0; col < len; col++) {
        const refByte = ref[col]!
        if (refByte !== DASH) {
          const refUpper = refByte & ~LOWER_BIT
          const a = aln[col]!
          if (refUpper !== N_UPPER && a !== DASH && a !== SPACE) {
            const b = Math.floor(bp / binBp)
            if (b !== bin[r]) {
              closeBin(r)
              bin[r] = b
              binLo[r] = bp
            }
            binHi[r] = bp
            classified[r]!++
            if ((a & ~LOWER_BIT) === refUpper) {
              matches[r]!++
            }
          }
          bp++
        }
      }
    }
  }
  for (let r = 0; r < n; r++) {
    closeBin(r)
    emitRun(r)
  }
  return {
    x: x.slice(0, count),
    x2: x2.slice(0, count),
    row: row.slice(0, count),
    step: step.slice(0, count),
    count,
  }
}

/** The identity heatmap: each run's cells in its ramp colour. */
export function identitySpans(runs: MafIdentityRuns): SpanChannels {
  return {
    x: runs.x,
    x2: runs.x2,
    row: runs.row,
    color: Uint32Array.from(runs.step, s => IDENTITY_ABGR[s]!),
    count: runs.count,
  }
}

/**
 * The X-Y plot: a bar per run as tall as its identity, on the ramp or in the
 * plot's one colour.
 */
export function identityBars(
  runs: MafIdentityRuns,
  ramp: boolean,
): MafIdentityBars {
  return {
    x: runs.x,
    x2: runs.x2,
    y: Float32Array.from(runs.step, s => s / STEPS),
    row: runs.row,
    color: ramp
      ? Uint32Array.from(runs.step, s => IDENTITY_ABGR[s]!)
      : new Uint32Array(runs.count).fill(XYPLOT_BAR_ABGR),
    count: runs.count,
  }
}

// Blocks are disjoint and ascending, so their ends ascend too.
function firstBlockEndingAfter(blocks: readonly MafBlock[], bp: number) {
  let lo = 0
  let hi = blocks.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (blocks[mid]!.endBp <= bp) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * One row's mean identity over `[startBp, endBp)`, the window a heatmap cell
 * or X-Y bar under the cursor averages, and how many bases it classified.
 */
export function identityOver(
  blocks: readonly MafBlock[],
  rowIndex: number,
  startBp: number,
  endBp: number,
) {
  let matched = 0
  let classifiedBases = 0
  for (let i = firstBlockEndingAfter(blocks, startBp); i < blocks.length; i++) {
    const block = blocks[i]!
    if (block.startBp >= endBp) {
      break
    }
    const aln = block.rows.find(r => r.rowIndex === rowIndex)?.alignmentBytes
    if (aln) {
      const ref = block.refSeqBytes
      const len = Math.min(aln.length, ref.length)
      let bp = block.startBp
      for (let col = 0; col < len && bp < endBp; col++) {
        const refByte = ref[col]!
        if (refByte !== DASH) {
          const refUpper = refByte & ~LOWER_BIT
          const a = aln[col]!
          if (
            bp >= startBp &&
            refUpper !== N_UPPER &&
            a !== DASH &&
            a !== SPACE
          ) {
            classifiedBases++
            if ((a & ~LOWER_BIT) === refUpper) {
              matched++
            }
          }
          bp++
        }
      }
    }
  }
  return classifiedBases > 0
    ? { identity: matched / classifiedBases, bases: classifiedBases }
    : undefined
}
