import { getSession } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
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

export function createTestEnvironment(opts?: {
  adapterFetchSizeLimit?: number
  // Spell slots out in long form: the `displayDefaults` shorthand is expanded
  // by a Core-preProcessTrackConfig handler this bare harness doesn't install.
  displayConfig?: Record<string, unknown>
}) {
  const env = createDisplayTestEnvironment<LinearMultiRowFeatureDisplayModel>({
    plugins: [new LinearGenomeViewPlugin()],
    trackType: 'FeatureTrack',
    adapter: {
      name: 'TestFeatureAdapter',
      slots: {
        fetchSizeLimit: { type: 'number', defaultValue: 0 },
      },
      config: {
        type: 'TestFeatureAdapter',
        fetchSizeLimit: opts?.adapterFetchSizeLimit ?? 0,
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

export const ctgA = REGIONS[0]!
export const ctgB = REGIONS[1]!

/**
 * Answers the column sort's `MultiRowValuesAt` call with `values` by row name,
 * where this harness has no worker to read the adapter in, and passes every
 * other call through. The returned mock records the sort's calls' args.
 */
export function stubColumnValues(
  display: LinearMultiRowFeatureDisplayModel,
  values: Record<string, string>,
) {
  const { rpcManager } = getSession(display)
  const original = rpcManager.call.bind(rpcManager)
  const valuesAt = jest.fn((_args: unknown) => new Map(Object.entries(values)))
  jest
    .spyOn(rpcManager, 'call')
    .mockImplementation((sessionId, method, args) =>
      method === 'MultiRowValuesAt'
        ? Promise.resolve(valuesAt(args))
        : original(sessionId, method, args),
    )
  return valuesAt
}

export function abgrsOf(colors: (string | undefined)[]) {
  return colors.map(c => (c === undefined ? undefined : cssColorToABGR(c)))
}
