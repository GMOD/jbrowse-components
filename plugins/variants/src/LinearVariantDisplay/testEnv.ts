import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearVariantDisplayModel } from './model.ts'

// For a test whose stub payload carries none of the record fields the records
// band reads.
export const RECORDS_BAND_OFF = { records: { show: false } }

// The shared variant display harness wired for the regular (genomic-position)
// display. Its row placement and hit test both read the containing view, so a
// bare `stateModel.create()` can't reach them.
export function createTestEnvironment({
  // Display config slots, for the ones with no setter (`domain`).
  displayConfig,
}: { displayConfig?: Record<string, unknown> } = {}) {
  const configSchema = configSchemaFactory()
  return createDisplayTestEnvironment<LinearVariantDisplayModel>({
    displayName: 'LinearVariantDisplay',
    configSchema,
    stateModel: stateModelFactory(configSchema),
    displayConfig,
  })
}
