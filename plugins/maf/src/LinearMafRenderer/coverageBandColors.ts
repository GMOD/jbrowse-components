import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { CoverageBandColors } from '@jbrowse/render-core/coverageBand'

/**
 * The coverage band's palette slots, packed the way the shared band takes
 * them. Resolved from the render state like every other layer, which is what
 * lets the SVG export colour the band from the export-chosen theme.
 *
 * All three interbase kinds take the insertion colour: a MAF alignment has no
 * clipping, so the softclip/hardclip slots exist only because the shared band
 * declares them.
 */
export function mafCoverageBandColors(
  palette: JBrowsePalette,
): CoverageBandColors {
  const { bases } = palette
  const insertion = cssColorToABGR(palette.insertion)
  return {
    coverage: cssColorToABGR(palette.coverage),
    baseA: cssColorToABGR(bases.A.main),
    baseC: cssColorToABGR(bases.C.main),
    baseG: cssColorToABGR(bases.G.main),
    baseT: cssColorToABGR(bases.T.main),
    baseN: cssColorToABGR(bases.N.main),
    insertionIndicator: insertion,
    softclipIndicator: insertion,
    hardclipIndicator: insertion,
  }
}
