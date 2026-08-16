import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearHicDisplayModel } from './model.ts'

// The shared display harness wired for the Hi-C display. HiC's whole fetch chain
// hangs off a one-shot `CoreGetInfo`, so its failure behavior is only reachable
// with a display that actually attaches — a bare `stateModel.create()` runs no
// `afterAttach` and reaches no containing view.
export function createTestEnvironment() {
  return createDisplayTestEnvironment<LinearHicDisplayModel>({
    trackType: 'HicTrack',
    displayName: 'LinearHicDisplay',
    configSchema: () => configSchemaF(),
    stateModel: (_pm, schema) => stateModelFactory(schema),
    viewModel: linearGenomeViewStateModelFactory,
    assemblyEnd: 10_000_000,
  })
}
