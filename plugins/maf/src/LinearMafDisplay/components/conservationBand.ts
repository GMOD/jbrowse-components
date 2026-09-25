import { coverageLayout } from '@jbrowse/alignments-core'

import type {
  MafCoverageRegion,
  MafIdentityBars,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

/**
 * Fixed 0–100% identity Y-axis ticks for the conservation band, inset by the
 * same `coverageLayout` margin its bars stand in, so the end labels align with
 * the band edges instead of being clipped at the SVG boundary.
 */
export function conservationTicks(conservationHeight: number): YScaleTicks {
  const { effectiveH, bottom } = coverageLayout(conservationHeight)
  const yTop = bottom - effectiveH
  return {
    yTop,
    yBottom: bottom,
    items: [
      { value: 100, y: yTop, label: '100%' },
      { value: 50, y: (yTop + bottom) / 2, label: '50%' },
      { value: 0, y: bottom, label: '0%' },
    ],
  }
}

/** Where the band's value scale runs: its height, and its top inside the band. */
export function conservationBarBand(conservationHeight: number) {
  const { effectiveH, bottom } = coverageLayout(conservationHeight)
  return { height: effectiveH, top: bottom - effectiveH }
}

/**
 * The conservation band as bars: the mean of `identityScores`, the fraction
 * of species matching the reference at each base, over absolute windows of
 * `binBp`, adjacent windows of one value merged. `NaN` (unclassifiable) bases
 * are skipped, and a window spans the bases it averaged, so unalignable
 * stretches read as empty rather than 0%.
 */
export function encodeConservation(
  { identityScores, coverageStartPos }: MafCoverageRegion,
  binBp: number,
  color: number,
): MafIdentityBars {
  const x: number[] = []
  const x2: number[] = []
  const y: number[] = []
  let bin = -1
  let lo = 0
  let hi = 0
  let sum = 0
  let n = 0
  const close = () => {
    if (n > 0) {
      const mean = sum / n
      const last = y.length - 1
      if (last >= 0 && y[last] === mean && x2[last] === lo) {
        x2[last] = hi + 1
      } else {
        x.push(lo)
        x2.push(hi + 1)
        y.push(mean)
      }
      sum = 0
      n = 0
    }
  }
  for (let i = 0; i < identityScores.length; i++) {
    const v = identityScores[i]!
    if (!Number.isNaN(v)) {
      const bp = coverageStartPos + i
      const b = Math.floor(bp / binBp)
      if (b !== bin) {
        close()
        bin = b
        lo = bp
      }
      hi = bp
      sum += v
      n++
    }
  }
  close()
  return {
    x: Uint32Array.from(x),
    x2: Uint32Array.from(x2),
    y: Float32Array.from(y),
    row: new Uint32Array(y.length),
    color: new Uint32Array(y.length).fill(color),
    count: y.length,
  }
}
