import { coverageBandMarks } from '@jbrowse/alignments-core'
import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'

import { effectiveBaseColors } from '../../features/mismatch/baseColors.ts'

import type { RGBColor } from '../../shaders/colors.ts'
import type { RenderState } from './rendererTypes.ts'
import type {
  CoverageBandRegion,
  CoverageBandState,
} from '@jbrowse/alignments-core'
import type {
  CoverageBandColors,
  CoverageBandModBuffer,
} from '@jbrowse/render-core/coverageBand'

/** The band's region as this display's worker packs it, modification slices included. */
export type AlignmentsCoverageRegion = CoverageBandRegion &
  CoverageBandModBuffer

type BandColorState = Pick<RenderState, 'colors' | 'showModifications'>

const packRgb = (rgb: RGBColor) => normalizedRgbToABGR(rgb[0], rgb[1], rgb[2])

// Memoized on the palette and the modifications mute, the way the base tables
// are: the band's state is read per block per layer, and the nine packs are
// the same bytes for every one of them.
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
 * The coverage band's half of a render state — the one lens from this
 * display's flat fields onto what the shared band draws and hit-tests by.
 * `coverageTopOffset` is 0 for the sticky ungrouped band; a grouped section
 * passes its scrolled top so the band scrolls with its section.
 */
export function coverageBandState(s: RenderState): CoverageBandState {
  return {
    height: s.coverageHeight,
    top: s.coverageTopOffset,
    domainMin: s.coverageMinDepth ?? 0,
    domainMax: s.coverageMaxDepth,
    scaleType: s.coverageScaleType,
    symlogConstant: s.coverageSymlogConstant,
    snpMinFrequency: s.coverageSnpMinFrequency,
    showInterbase: s.showInterbaseIndicators,
    colors: bandColors(s),
  }
}

/**
 * The coverage band above the pileup, as the shared band's five layers. Both
 * renderers walk this list inside the section's own clip; neither declares a
 * `band` on it because a grouped section carries its own.
 */
export const ALIGNMENTS_COVERAGE_MARKS = coverageBandMarks({
  channels: (r: AlignmentsCoverageRegion) => r,
  state: coverageBandState,
  modCov: true,
})
