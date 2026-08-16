import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearWiggleDisplayModel } from './model.ts'

// The shared display harness wired for the single-source wiggle display. The
// adapter declares `hasResolution` because the resolution submenu is gated on
// it.
export function createTestEnvironment() {
  return createDisplayTestEnvironment<LinearWiggleDisplayModel>({
    trackType: 'QuantitativeTrack',
    adapter: { name: 'BigWigAdapter', capabilities: ['hasResolution'] },
    displayName: 'LinearWiggleDisplay',
    configSchema: () => configSchemaFactory,
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    viewRegionEnd: 10_000,
  })
}
