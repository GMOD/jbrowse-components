import { setupColorByAutorun } from './colorByAutorun.ts'
import { getMultiSampleVariantSourcesAutorun } from './getMultiSampleVariantSourcesAutorun.ts'
import { getWebGLVariantCellDataAutorun } from './getWebGLVariantCellDataAutorun.ts'
import { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'

export function setupMultiSampleVariantAutoruns(self: any) {
  getMultiSampleVariantSourcesAutorun(self)
  setupTreeDrawingAutorun(self)
  setupColorByAutorun(self)
  getWebGLVariantCellDataAutorun(self)
}
