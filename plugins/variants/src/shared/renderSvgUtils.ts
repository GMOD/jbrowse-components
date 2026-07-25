import type { RowColorsModel } from './components/types.ts'
import type { Source } from './types.ts'
import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { LegendSection } from '@jbrowse/plugin-linear-genome-view'

// Extends RowColorsModel because the export paints its sidebar row colors with
// the same live component the on-screen overlay does — see SvgVariantOverlay.
export interface RenderSvgBaseModel extends SvgExportable, RowColorsModel {
  cellData: CellDataResult | undefined
  regionTooLarge: boolean
  // Top strip the rows sit below (the matrix display's connector-line zone,
  // always 0 for the regular display).
  lineZoneHeight: number
  sources: Source[] | undefined
  showLegend: boolean
  legendSections(): LegendSection[]
}
