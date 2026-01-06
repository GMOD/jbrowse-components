import { measureText } from '@jbrowse/core/util'

import type { LegendItem } from './components/FloatingLegend.tsx'

const LEGEND_FONT_SIZE = 10
const LEGEND_BOX_SIZE = 12
const LEGEND_PADDING = 3

/**
 * Calculate the width needed for an SVG legend based on the legend items.
 * Used by SVG export to add extra width for the legend area.
 */
export function calculateSvgLegendWidth(items: LegendItem[]): number {
  if (items.length === 0) {
    return 0
  }
  const maxLabelWidth = Math.max(
    ...items.map(item => measureText(item.label, LEGEND_FONT_SIZE)),
  )
  return LEGEND_BOX_SIZE + 8 + maxLabelWidth + LEGEND_PADDING * 2 + 20
}
