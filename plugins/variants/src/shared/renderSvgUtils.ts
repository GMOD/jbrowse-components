import type { Source } from './types.ts'
import type { VariantTopBands } from './variantTopBands.ts'
import type { LgvSvgExportable } from '@jbrowse/display-kit/renderDisplaySvg'
import type { SvgSidebarProps } from '@jbrowse/tree-sidebar'

// Hand-written rather than the model type, since renderSvg loads lazily and
// importing the model there is a circular reference. The rows' viewport is
// `availableHeight`, not the display `height` `LgvSvgExportable` brings: the
// rows sit below the bands stacked above them.
export interface RenderSvgBaseModel extends LgvSvgExportable {
  scrollTop: number
  availableHeight: number
  effectiveRowHeight: number
  sources: Source[]
  showRowSeparators: boolean
  canvasWidthPx: number
  // Px the rows sit below: the variant lane plus the columns layout's
  // connector-line zone. See shared/variantTopBands.ts.
  rowsTopOffset: number
  topBands: VariantTopBands
  svgSidebar: SvgSidebarProps
}
