import { setupColorByAutorun } from './colorByAutorun.ts'
import { getMultiVariantFeaturesAutorun } from './getMultiVariantFeaturesAutorun.ts'
import { getMultiVariantSourcesAutorun } from './getMultiVariantSourcesAutorun.ts'
import { getWebGLVariantCellDataAutorun } from './getWebGLVariantCellDataAutorun.ts'
import { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'

import type { MultiVariantBaseModel } from './MultiVariantBaseModel.ts'

/**
 * Sets up the autoruns for multi-variant displays.
 * This is shared between MultiLinearVariantDisplay and LinearVariantMatrixDisplay.
 */
export function setupMultiVariantAutoruns(self: MultiVariantBaseModel) {
  getMultiVariantSourcesAutorun(self)
  getMultiVariantFeaturesAutorun(self)
  setupTreeDrawingAutorun(self)
  setupColorByAutorun(self)
  // WebGL displays add setWebGLCellData action - duck-type check
  if ('setWebGLCellData' in self) {
    getWebGLVariantCellDataAutorun(
      self as MultiVariantBaseModel & {
        webglCellDataMode: 'regular' | 'matrix'
        setWebGLCellData: (data: unknown) => void
      },
    )
  }
}
