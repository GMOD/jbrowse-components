import {
  DASH,
  isGapByte,
  isUnknownBase,
  sameBase,
} from '@jbrowse/core/util/alignedBytes'
import { cssColorToABGR, packAbgr } from '@jbrowse/core/util/colorBits'
import { colorRampStops, sampleColorRamp } from '@jbrowse/core/util/colorRamp'
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import {
  SCALE_TYPE_LINEAR,
  makeScoreNormalizer,
} from '@jbrowse/render-core/scoreScale'
import { rampMidT } from '@jbrowse/render-core/shaders/colorRampLut'

import { MAF_FIELD_PRESETS } from '../LinearMafDisplay/mafColorConfigSchema.ts'

import type { MafBlock, MafIdentityBars } from './mafRenderingBackendTypes.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorRampStop } from '@jbrowse/core/util/colorRamp'
import type { ContinuousRef } from '@jbrowse/core/util/markEncoding'
import type { SpanChannels } from '@jbrowse/render-core/marks'

/** How the identity plot draws: a ramp per cell, or a bar per cell. */
export type IdentityPlot = 'heatmap' | 'xyplot'

/**
 * Identity is quantized to hundredths: the ramp's steps, and finer than a row
 * band's bar height can show.
 */
const STEPS = 100

/** The identity ramp as `color` declares it while its field is identity. */
export type IdentityRamp = Omit<ContinuousRef, 'field' | 'scale'>

const DEFAULT_IDENTITY_RAMP: IdentityRamp = MAF_FIELD_PRESETS.identity

const MAX_KEY_STOPS = 9

function identityScaleOf(ramp: IdentityRamp) {
  const { domain, midNorm } = continuousColorScale(
    { ...ramp, field: 'identity', scale: 'linear' },
    [0, 1],
  )
  const norm = makeScoreNormalizer(domain[0], domain[1], SCALE_TYPE_LINEAR, 1)
  const stops = colorRampStops(ramp)
  const atFraction = (t: number) => sampleColorRamp(stops, rampMidT(t, midNorm))
  return {
    domain,
    atFraction,
    at: (identity: number) => atFraction(norm(identity)),
    // where the ramp's stops land across the domain, up to nine of them, so
    // the key's straight segments between them draw the ramp
    keyOffsets: () => {
      const n = Math.min(stops.length, MAX_KEY_STOPS)
      const half = Math.max(midNorm, 1 - midNorm)
      const inner = Array.from(
        { length: n },
        (_, i) => (i / Math.max(n - 1, 1)) * 2 * half - (half - midNorm),
      ).filter(t => t > 0 && t < 1)
      return [...new Set([0, ...inner, 1])].sort((a, b) => a - b)
    },
  }
}

const DEFAULT_IDENTITY_SCALE = identityScaleOf(DEFAULT_IDENTITY_RAMP)

function rgbOf([r, g, b]: ColorRampStop) {
  return `rgb(${r},${g},${b})`
}

/**
 * The default ramp: divergent red (0) through a grey neutral (0.5) to
 * conserved blue (1). The grey middle keeps low identity visible where a white
 * one would vanish.
 */
export function identityColor(t: number): [number, number, number] {
  const [r, g, b] = DEFAULT_IDENTITY_SCALE.at(t)
  return [r, g, b]
}

export function identityRgb(t: number) {
  return rgbOf(DEFAULT_IDENTITY_SCALE.at(t))
}

const MAX_IDENTITY_LUTS = 16
const identityLuts = new Map<string, Uint32Array>()

/**
 * The ramp's packed colour at each hundredth of identity, the same array for
 * the same ramp, so a declaration read again re-encodes nothing. The domain
 * and the middle are `continuousColorScale`'s; the stops are sampled at each
 * hundredth rather than read off its 256-entry table, whose rounding would
 * move a third of the default ramp's entries by one.
 */
export function identityLut(
  ramp: IdentityRamp = DEFAULT_IDENTITY_RAMP,
): Uint32Array {
  const key = JSON.stringify([
    ramp.scheme,
    !!ramp.reverse,
    ramp.range,
    ramp.domainMin,
    ramp.domainMax,
    ramp.domainMid,
  ])
  let lut = identityLuts.get(key)
  if (!lut) {
    if (identityLuts.size >= MAX_IDENTITY_LUTS) {
      identityLuts.delete(identityLuts.keys().next().value!)
    }
    const scale = identityScaleOf(ramp)
    lut = Uint32Array.from({ length: STEPS + 1 }, (_, i) => {
      const [r, g, b, a] = scale.at(i / STEPS)
      return packAbgr(r, g, b, a)
    })
    identityLuts.set(key, lut)
  }
  return lut
}

const XYPLOT_BAR_RGB = identityRgb(1)
const XYPLOT_BAR_ABGR = cssColorToABGR(XYPLOT_BAR_RGB)

/**
 * The key for whichever identity plot draws: the ramp, the X-Y plot's one bar
 * colour with its height named, or the ramp's two ends where each cell is one
 * base, which matches or not, so the ramp's middle is never drawn.
 */
export function identityColorScale(
  mode: IdentityPlot,
  oneBaseCells = false,
  title = 'Per-base identity to reference',
  ramp = DEFAULT_IDENTITY_RAMP,
): ColorScale {
  const scale = identityScaleOf(ramp)
  if (mode === 'heatmap' && oneBaseCells) {
    return {
      kind: 'categorical',
      id: 'heatmap-base',
      title,
      entries: [
        {
          value: 'match',
          label: 'Conserved (base matches)',
          color: rgbOf(scale.at(1)),
        },
        {
          value: 'mismatch',
          label: 'Divergent (base differs)',
          color: rgbOf(scale.at(0)),
        },
      ],
    }
  }
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
        domain: scale.domain,
        stops: scale.keyOffsets().map(offset => ({
          offset,
          color: rgbOf(scale.atFraction(offset)),
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

function compares(refByte: number, alnByte: number) {
  return !isUnknownBase(refByte) && !isGapByte(alnByte)
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
          const a = aln[col]!
          if (compares(refByte, a)) {
            const b = Math.floor(bp / binBp)
            if (b !== bin[r]) {
              closeBin(r)
              bin[r] = b
              binLo[r] = bp
            }
            binHi[r] = bp
            classified[r]!++
            if (sameBase(a, refByte)) {
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
export function identitySpans(
  runs: MafIdentityRuns,
  lut = identityLut(),
): SpanChannels {
  return {
    x: runs.x,
    x2: runs.x2,
    row: runs.row,
    color: Uint32Array.from(runs.step, s => lut[s]!),
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
  lut = identityLut(),
): MafIdentityBars {
  return {
    x: runs.x,
    x2: runs.x2,
    y: Float32Array.from(runs.step, s => s / STEPS),
    row: runs.row,
    color: ramp
      ? Uint32Array.from(runs.step, s => lut[s]!)
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
          const a = aln[col]!
          if (bp >= startBp && compares(refByte, a)) {
            classifiedBases++
            if (sameBase(a, refByte)) {
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
