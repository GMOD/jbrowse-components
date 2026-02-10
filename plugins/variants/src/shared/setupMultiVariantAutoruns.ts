import { setupColorByAutorun } from './colorByAutorun.ts'
import { getMultiVariantFeaturesAutorun } from './getMultiVariantFeaturesAutorun.ts'
import { getMultiVariantSourcesAutorun } from './getMultiVariantSourcesAutorun.ts'
import { getWebGLVariantCellDataAutorun } from './getWebGLVariantCellDataAutorun.ts'
import { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'

/**
 * Sets up the autoruns for multi-variant displays.
 * This is shared between MultiLinearVariantDisplay and LinearVariantMatrixDisplay.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupMultiVariantAutoruns(self: any) {
  getMultiVariantSourcesAutorun(self)
  getMultiVariantFeaturesAutorun(self)
  setupTreeDrawingAutorun(self)
  setupColorByAutorun(self)
  // WebGL displays add setWebGLCellData action - duck-type check
  if ('setWebGLCellData' in self) {
    getWebGLVariantCellDataAutorun(self)
  }
}
