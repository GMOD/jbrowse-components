import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearMultiSampleVariantMatrixDisplayModel } from './model.ts'

// The shared variant display harness wired for the matrix display, whose column
// geometry only exists relative to a containing view.
export function createTestEnvironment() {
  const configSchema = configSchemaFactory()
  return createDisplayTestEnvironment<LinearMultiSampleVariantMatrixDisplayModel>(
    {
      displayName: 'LinearMultiSampleVariantMatrixDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
    },
  )
}
