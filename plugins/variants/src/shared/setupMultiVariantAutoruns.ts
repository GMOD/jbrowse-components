import { getMultiVariantFeaturesAutorun } from './getMultiVariantFeaturesAutorun.ts'
import { getMultiVariantSourcesAutorun } from './getMultiVariantSourcesAutorun.ts'
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
}
