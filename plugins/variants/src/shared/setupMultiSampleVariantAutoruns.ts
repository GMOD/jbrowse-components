import { setupColorByAutorun } from './colorByAutorun.ts'
import { getMultiSampleVariantSourcesAutorun } from './getMultiSampleVariantSourcesAutorun.ts'
import { getVariantCellDataAutorun } from './getVariantCellDataAutorun.ts'
import { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'

export function setupMultiSampleVariantAutoruns(self: any) {
  getMultiSampleVariantSourcesAutorun(self)
  setupTreeDrawingAutorun(self)
  setupColorByAutorun(self)
  getVariantCellDataAutorun(self)
}
