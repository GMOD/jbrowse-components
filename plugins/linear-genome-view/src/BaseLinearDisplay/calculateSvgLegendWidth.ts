import { measureText } from '@jbrowse/core/util'

import type { LegendItem } from './components/FloatingLegend.tsx'

export const LEGEND_FONT_SIZE = 10
export const LEGEND_BOX_SIZE = 12
export const LEGEND_PADDING = 3

export function legendBoxWidth(items: LegendItem[]): number {
  const maxLabelWidth = Math.max(
    ...items.map(item => measureText(item.label, LEGEND_FONT_SIZE)),
  )
  return LEGEND_BOX_SIZE + 8 + maxLabelWidth + LEGEND_PADDING * 2
}

// +20 is breathing room between the figure and the legend panel
export function calculateSvgLegendWidth(items: LegendItem[]): number {
  return items.length === 0 ? 0 : legendBoxWidth(items) + 20
}
