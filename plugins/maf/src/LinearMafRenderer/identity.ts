import {
  DASH,
  LOWER_BIT,
  isGapByte,
  isUnknownBase,
  sameBase,
} from '@jbrowse/core/util/alignedBytes'
import { packAbgr } from '@jbrowse/core/util/colorBits'
import {
  colorRampStops,
  rampDomain,
  sampleColorRamp,
} from '@jbrowse/core/util/colorRamp'
import {
  SCALE_TYPE_LINEAR,
  makeScoreNormalizer,
  rampMidNorm,
} from '@jbrowse/render-core/scoreScale'
import { rampMidT } from '@jbrowse/render-core/shaders/colorRampLut'

import { MAF_FIELD_PRESETS } from '../LinearMafDisplay/mafColorConfigSchema.ts'
import { firstBlockEndingAfter } from './blockAtBp.ts'

import type { MafBlock, MafIdentityBars } from './mafRenderingBackendTypes.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorRampStop } from '@jbrowse/core/util/colorRamp'
import type { ContinuousRef } from '@jbrowse/core/util/markEncoding'
import type { SpanChannels } from '@jbrowse/render-core/marks'

/**
 * Identity is quantized to hundredths: the ramp's steps, and finer than a row
 * band's bar height can show.
 */
const STEPS = 100

/** The identity ramp as `encoding.color` declares it while its field is identity. */
export type IdentityRamp = Omit<ContinuousRef, 'field' | 'scale'>

const DEFAULT_IDENTITY_RAMP: IdentityRamp = MAF_FIELD_PRESETS.identity.scale

const MAX_KEY_STOPS = 9

function identityScaleOf(ramp: IdentityRamp) {
  const domain = rampDomain(ramp.domainMin, ramp.domainMax, [0, 1])
  const midNorm = rampMidNorm(
    domain[0],
    domain[1],
    SCALE_TYPE_LINEAR,
    ramp.domainMid,
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
export function identityRgb(t: number) {
  return rgbOf(DEFAULT_IDENTITY_SCALE.at(t))
}

const MAX_IDENTITY_LUTS = 16
const identityLuts = new Map<string, Uint32Array>()

/**
 * The ramp's packed color at each hundredth of identity, the same array for
 * the same ramp, so a declaration read again re-encodes nothing. The stops
 * are sampled at each hundredth rather than read off a 256-entry ramp table,
 * whose rounding would move a third of the default ramp's entries by one.
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

/** The X-Y plot's one bar color, where no fill colors its bars. */
export const XYPLOT_BAR_COLOR = identityRgb(1)

/**
 * The identity fill's key: the ramp, or its two ends where each cell is one
 * base, which matches or not, so the ramp's middle is never drawn.
 */
export function identityColorScale(
  oneBaseCells = false,
  title = 'Per-base identity to reference',
  ramp = DEFAULT_IDENTITY_RAMP,
): ColorScale {
  const scale = identityScaleOf(ramp)
  return oneBaseCells
    ? {
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
    : {
        kind: 'ramp',
        id: 'heatmap',
        title,
        domain: scale.domain,
        stops: scale.keyOffsets().map(offset => ({
          offset,
          color: rgbOf(scale.atFraction(offset)),
        })),
        format: v => `${Math.round(v * 100)}%`,
      }
}

/** The X-Y plot's key where one color fills its bars: what the height means. */
export function barHeightScale(
  title = 'Per-base identity to reference',
  color = XYPLOT_BAR_COLOR,
): ColorScale {
  return {
    kind: 'categorical',
    id: 'xyplot',
    title,
    entries: [
      {
        value: 'bar',
        label: 'Bar height: full = conserved, flat = divergent',
        color,
      },
    ],
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
 *
 * Core's `binnedCellMatches` shares the base tests but not this walk: it reads
 * feature-table texts, returns bin-edged groups with ids and hover JSON, and
 * makes groups for gap-only runs where this emits nothing.
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

  let colBp = new Int32Array(0)
  let colBase = new Uint8Array(0)
  for (const block of blocks) {
    const ref = block.refSeqBytes
    if (colBp.length < ref.length) {
      colBp = new Int32Array(ref.length)
      colBase = new Uint8Array(ref.length)
    }
    let bp = block.startBp
    for (let col = 0; col < ref.length; col++) {
      const refByte = ref[col]!
      if (refByte === DASH) {
        colBp[col] = -1
      } else {
        colBp[col] = isUnknownBase(refByte) ? -1 : bp
        colBase[col] = refByte | LOWER_BIT
        bp++
      }
    }
    for (const { rowIndex: r, alignmentBytes: aln } of block.rows) {
      const len = Math.min(aln.length, ref.length)
      let lo = bin[r]! * binBp
      let edge = lo + binBp
      let m = matches[r]!
      let c = classified[r]!
      let hi = binHi[r]!
      for (let col = 0; col < len; col++) {
        const p = colBp[col]!
        if (p >= 0) {
          const a = aln[col]!
          if (!isGapByte(a)) {
            if (p >= edge || p < lo) {
              matches[r] = m
              classified[r] = c
              binHi[r] = hi
              closeBin(r)
              const b = Math.floor(p / binBp)
              bin[r] = b
              binLo[r] = p
              lo = b * binBp
              edge = lo + binBp
              m = 0
              c = 0
            }
            hi = p
            c++
            if ((a | LOWER_BIT) === colBase[col]) {
              m++
            }
          }
        }
      }
      matches[r] = m
      classified[r] = c
      binHi[r] = hi
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

/** The identity heatmap: each run's cells in its ramp color. */
export function identitySpans(
  runs: MafIdentityRuns,
  lut = identityLut(),
): SpanChannels {
  return {
    x: runs.x,
    x2: runs.x2,
    row: runs.row,
    color: identityRunColors(runs, lut),
    count: runs.count,
  }
}

/** Each run's ramp color, the X-Y plot's bars under an identity fill. */
export function identityRunColors(runs: MafIdentityRuns, lut = identityLut()) {
  const { step } = runs
  const color = new Uint32Array(step.length)
  for (let i = 0; i < step.length; i++) {
    color[i] = lut[step[i]!]!
  }
  return color
}

/** The X-Y plot: a bar per run as tall as its identity, in `colors`. */
export function identityBars(
  runs: MafIdentityRuns,
  colors: Uint32Array,
): MafIdentityBars {
  const { step } = runs
  const y = new Float32Array(step.length)
  for (let i = 0; i < step.length; i++) {
    y[i] = step[i]! / STEPS
  }
  return {
    x: runs.x,
    x2: runs.x2,
    y,
    row: runs.row,
    color: colors,
    count: runs.count,
  }
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
