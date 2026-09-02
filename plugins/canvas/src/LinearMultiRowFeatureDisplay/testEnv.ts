import { densityAdapterConfigSchemaFields } from '@jbrowse/core/data_adapters/BaseAdapter'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearMultiRowFeatureDisplayModel } from './model.ts'
import type { Region } from '@jbrowse/core/util'

const REGIONS = ['ctgA', 'ctgB'].map(refName => ({
  refName,
  start: 0,
  end: 10_000_000,
  assemblyName: 'volvox',
}))

// The shared display harness wired for the multi-row display. Exercises the
// byte gate through the real state model without a worker: stage a byte
// estimate and read the derived regionTooLarge. `createDisplay()` takes
// the displayed regions, so a test can load one contig out of the two the
// assembly declares.
export function createTestEnvironment(opts?: {
  adapterFetchSizeLimit?: number
  // The sidecar the density tier draws from. Only its presence is read here —
  // nothing resolves it — so any object stands in for one.
  densityAdapter?: Record<string, unknown>
  // Display config slots, which the harness writes into the track config's own
  // `displays` entry — the long form of the `displayDefaults` shorthand, and the
  // only way to reach a slot with no setter (`rowGroups`). The shorthand itself
  // is expanded by a Core-preProcessTrackConfig handler this bare harness
  // doesn't install, so spell it out.
  displayConfig?: Record<string, unknown>
}) {
  const densityAdapter = opts?.densityAdapter
  const env = createDisplayTestEnvironment<LinearMultiRowFeatureDisplayModel>({
    plugins: [new LinearGenomeViewPlugin()],
    trackType: 'FeatureTrack',
    adapter: {
      name: 'TestFeatureAdapter',
      slots: {
        fetchSizeLimit: { type: 'number', defaultValue: 0 },
        ...densityAdapterConfigSchemaFields,
      },
      config: {
        type: 'TestFeatureAdapter',
        fetchSizeLimit: opts?.adapterFetchSizeLimit ?? 0,
        ...(densityAdapter === undefined ? {} : { densityAdapter }),
      },
    },
    displayName: 'LinearMultiRowFeatureDisplay',
    configSchema: () => configSchemaF(),
    stateModel: (_pm, schema) => stateModelFactory(schema),
    viewModel: linearGenomeViewStateModelFactory,
    regions: REGIONS.slice(0, 1),
    assemblyRegions: REGIONS,
    displayConfig: opts?.displayConfig,
  })
  return {
    ...env,
    createDisplay: (displayedRegions?: Region[]) =>
      env.createDisplay({ displayedRegions }),
  }
}
