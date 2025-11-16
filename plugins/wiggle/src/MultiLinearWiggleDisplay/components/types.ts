import type { Source } from '../types'

export interface MinimalModel {
  graphType: boolean
  needsFullHeightScalebar: boolean
  rowHeightTooSmallForScalebar: boolean
  sources: Source[] | undefined
  renderColorBoxes: boolean
  labelWidth: number
  needsCustomLegend: boolean
}
