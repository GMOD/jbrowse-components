import type { Source } from '../types.ts'

// What the row separators read, on screen and in the SVG export. The viewport
// is `availableHeight`, not the display `height`: the rows sit below the bands
// stacked above them (the variant lane, the columns layout's connector zone).
export interface VariantRowsModel {
  scrollTop: number
  availableHeight: number
  effectiveRowHeight: number
  sources: Source[]
  showRowSeparators: boolean
  canvasWidthPx: number
}
