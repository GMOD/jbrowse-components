import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { CoverageBandColors } from '@jbrowse/render-core/coverageBand'

/**
 * The coverage band's colours as CSS strings — what the Canvas2D painters in
 * `@jbrowse/alignments-core` take.
 *
 * The band used to read `useTheme()` straight from its own component, which made
 * it the one MAF layer not coloured through `resolvePalette`. Now that it draws
 * from the shared renderer it has to come through the render state like every
 * other layer, which is also what lets the SVG export colour it from the
 * export-chosen theme rather than the live one.
 *
 * All three interbase kinds take the insertion colour: a MAF alignment has no
 * clipping, so the softclip/hardclip slots exist only because the shared passes
 * declare them.
 */
export interface MafCoverageColors {
  coverage: string
  baseA: string
  baseC: string
  baseG: string
  baseT: string
  baseN: string
  insertion: string
}

export function getMafCoverageColors(
  palette: JBrowsePalette,
): MafCoverageColors {
  const { bases } = palette
  return {
    coverage: palette.coverage,
    baseA: bases.A.main,
    baseC: bases.C.main,
    baseG: bases.G.main,
    baseT: bases.T.main,
    baseN: bases.N.main,
    insertion: palette.insertion,
  }
}

export function packMafCoverageColors(
  c: MafCoverageColors,
): CoverageBandColors {
  const insertion = cssColorToABGR(c.insertion)
  return {
    coverage: cssColorToABGR(c.coverage),
    baseA: cssColorToABGR(c.baseA),
    baseC: cssColorToABGR(c.baseC),
    baseG: cssColorToABGR(c.baseG),
    baseT: cssColorToABGR(c.baseT),
    baseN: cssColorToABGR(c.baseN),
    insertionIndicator: insertion,
    softclipIndicator: insertion,
    hardclipIndicator: insertion,
  }
}
