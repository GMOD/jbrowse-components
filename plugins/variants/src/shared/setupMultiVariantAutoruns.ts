import { getMultiVariantFeaturesAutorun } from '../getMultiVariantFeaturesAutorun'
import { getMultiVariantSourcesAutorun } from '../getMultiVariantSourcesAutorun'
import { setupTreeDrawingAutorun } from './treeDrawingAutorun'

import type { MultiVariantBaseModel } from './MultiVariantBaseModel'

/**
 * Sets up the autoruns for multi-variant displays.
 * This is shared between MultiLinearVariantDisplay and LinearVariantMatrixDisplay.
 */
export function setupMultiVariantAutoruns(self: MultiVariantBaseModel) {
  getMultiVariantSourcesAutorun(self)
  getMultiVariantFeaturesAutorun(self)
  setupTreeDrawingAutorun(self)
}
