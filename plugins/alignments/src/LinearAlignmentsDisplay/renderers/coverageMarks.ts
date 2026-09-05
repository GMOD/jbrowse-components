import { coverageBandMarks } from '@jbrowse/alignments-core'
import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'

import { effectiveBaseColors } from '../../features/mismatch/baseColors.ts'

import type { CoverageBandRegion } from '../../features/coverage/types.ts'
import type { RGBColor } from '../../shaders/colors.ts'
import type { RenderState } from './rendererTypes.ts'
import type { CoverageBandColors } from '@jbrowse/render-core/coverageBand'

type BandColorState = Pick<RenderState, 'colors' | 'showModifications'>

const packRgb = (rgb: RGBColor) => normalizedRgbToABGR(rgb[0], rgb[1], rgb[2])

// Memoized on the palette and the modifications mute, the way the base tables
// are: the band's params run per block per layer, and the nine packs are the
// same bytes for every one of them.
let colorMemo: (BandColorState & { packed: CoverageBandColors }) | undefined

function bandColors(state: BandColorState): CoverageBandColors {
  if (
    colorMemo?.colors !== state.colors ||
    colorMemo.showModifications !== state.showModifications
  ) {
    const { colors } = state
    const base = effectiveBaseColors(state)
    colorMemo = {
      colors,
      showModifications: state.showModifications,
      packed: {
        coverage: packRgb(colors.colorCoverage),
        baseA: packRgb(base.A),
        baseC: packRgb(base.C),
        baseG: packRgb(base.G),
        baseT: packRgb(base.T),
        baseN: packRgb(base.N),
        insertionIndicator: packRgb(colors.colorInsertionIndicator),
        softclipIndicator: packRgb(colors.colorSoftclipIndicator),
        hardclipIndicator: packRgb(colors.colorHardclipIndicator),
      },
    }
  }
  return colorMemo.packed
}

/**
 * The coverage band above the pileup, as the shared band's five layers: which
 * of a region's fields are its buffers, and which of the render state's values
 * are the band's. Both renderers walk this list inside the band's own clip;
 * neither declares a `band` on it because a grouped section carries its own.
 *
 * `showInterbaseIndicators` governs the count bars and the triangles alike,
 * and the indicator layer draws before the domain resolves: its triangles are
 * fixed-size, and gating them on data would blank them for the whole fetch.
 */
export const ALIGNMENTS_COVERAGE_MARKS = coverageBandMarks({
  channels: (r: CoverageBandRegion) => r,
  params: (s: RenderState, r) => ({
    height: s.coverageHeight,
    // 0 = sticky (ungrouped); a grouped section passes its scrolled top so
    // the band scrolls with its section.
    top: s.coverageTopOffset,
    domainMin: s.coverageMinDepth ?? 0,
    domainMax: s.coverageMaxDepth,
    scaleType: s.coverageScaleType,
    symlogConstant: s.coverageSymlogConstant,
    regionMaxDepth: r.coverageMaxDepth,
    binSize: r.coverageBinSize,
    interbaseMaxCount: r.interbaseMaxCount,
    snpMinFrequency: s.coverageSnpMinFrequency,
    showInterbase: s.showInterbaseIndicators,
    colors: bandColors(s),
  }),
  modCov: true,
})
