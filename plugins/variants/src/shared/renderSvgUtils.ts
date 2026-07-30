import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { SampleRowLabelsModel } from './components/types.ts'
import type { Source } from './types.ts'
import type {
  LegendSection,
  LgvSvgExportable,
} from '@jbrowse/plugin-linear-genome-view'

// Extends SampleRowLabelsModel because the export paints its sidebar row colors with
// the same live component the on-screen overlay does — see SvgVariantOverlay.
// `LgvSvgExportable` brings the display-band `height` the export shell frames
// with; the gutter's own viewport is the `availableHeight` below `lineZoneHeight`.
export interface RenderSvgBaseModel
  extends LgvSvgExportable, SampleRowLabelsModel {
  cellData: CellDataResult | undefined
  // Top strip the rows sit below (the matrix display's connector-line zone,
  // always 0 for the regular display).
  lineZoneHeight: number
  sources: Source[] | undefined
  showLegend: boolean
  legendSections(): LegendSection[]
}
