import type { VariantRowsModel } from './components/types.ts'
import type { VariantTopBands } from './variantTopBands.ts'
import type { LgvSvgExportable } from '@jbrowse/display-kit/renderDisplaySvg'
import type { SvgSidebarProps } from '@jbrowse/tree-sidebar'

// The export draws its separators off the same geometry the screen does, and
// its sidebar from `svgSidebar`. `LgvSvgExportable` brings the display-band
// `height` the export shell frames with.
export interface RenderSvgBaseModel extends LgvSvgExportable, VariantRowsModel {
  // Px the rows sit below: the variant lane plus the columns layout's
  // connector-line zone. See shared/variantTopBands.ts.
  rowsTopOffset: number
  topBands: VariantTopBands
  svgSidebar: SvgSidebarProps
}
