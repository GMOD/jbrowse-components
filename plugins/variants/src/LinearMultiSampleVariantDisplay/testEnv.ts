import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearMultiSampleVariantDisplayModel } from './model.ts'

// The shared variant display harness wired for the regular (genomic-position)
// display. Its row placement and hit test both read the containing view, so a
// bare `stateModel.create()` can't reach them.
export function createTestEnvironment({
  // Display config slots, for the ones with no setter (`domain`).
  displayConfig,
}: { displayConfig?: Record<string, unknown> } = {}) {
  const configSchema = configSchemaFactory()
  return createDisplayTestEnvironment<LinearMultiSampleVariantDisplayModel>({
    displayName: 'LinearMultiSampleVariantDisplay',
    configSchema,
    stateModel: stateModelFactory(configSchema),
    displayConfig,
  })
}
