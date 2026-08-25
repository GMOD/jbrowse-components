import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { VariantRowsModel } from './components/types.ts'
import type { VariantTopBands } from './variantTopBands.ts'
import type { LgvSvgExportable } from '@jbrowse/display-kit/renderDisplaySvg'
import type { LegendSection } from '@jbrowse/plugin-linear-genome-view'
import type { ClusterProvenance } from '@jbrowse/tree-sidebar'

// Extends VariantRowsModel because the export draws its rows' labels and
// separators off the same geometry the on-screen overlay does — see
// SvgVariantOverlay. `LgvSvgExportable` brings the display-band `height` the
// export shell frames with; the rows' own viewport is the `availableHeight`
// below `rowsTopOffset`.
export interface RenderSvgBaseModel extends LgvSvgExportable, VariantRowsModel {
  // for svgNodeId, so the export's clip id is stable across session loads
  id: string
  configuration?: { displayId?: string }
  cellData: CellDataResult | undefined
  // Px the rows sit below: the variant lane plus the matrix display's
  // connector-line zone. See shared/variantTopBands.ts.
  rowsTopOffset: number
  topBands: VariantTopBands
  showLegend: boolean
  // `insertionColor` overrides the marker swatch so it can follow the export
  // theme's palette, which is what the exported glyphs are painted with.
  legendSections(insertionColor?: string): LegendSection[]
  // Captioned above the exported tree: which locus and settings produced it.
  // Undefined when no clustering has been run.
  clusterProvenance?: ClusterProvenance
}
