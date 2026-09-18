import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import { configSchemaFactory } from './configSchemaFactory.ts'
import { stateModelFactory } from './stateModelFactory.ts'

import type { LinearManhattanDisplayModel } from './stateModelFactory.ts'

// Two displayed regions, because the behaviours worth testing here are about
// what happens across a multi-region load — the LD auto-index has to survive a
// partially-arrived batch.
const REGIONS = ['ctgA', 'ctgB'].map(refName => ({
  refName,
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}))

/**
 * The shared display harness wired for the Manhattan display.
 *
 * `color` is an environment option rather than a `createDisplay` one because
 * it is a config slot, and the fetch autorun runs on the leading edge: a slot
 * written after the display attaches is a *user flipping the setting*, which
 * legitimately costs a refetch. A session restoring a track with
 * `color: { field: 'ld' }` has the slot before `afterAttach`, so the harness
 * must too, or every LD test measures one round trip that production never
 * makes.
 */
export function createTestEnvironment({
  color,
  ldAdapter = true,
}: {
  color?: string | Record<string, unknown>
  ldAdapter?: boolean
} = {}) {
  const env = createDisplayTestEnvironment<LinearManhattanDisplayModel>({
    plugins: [new LinearGenomeViewPlugin()],
    trackType: 'GWASTrack',
    adapter: {
      name: 'GWASAdapter',
      slots: { ldAdapter: { type: 'frozen', defaultValue: null } },
      config: {
        type: 'GWASAdapter',
        ...(ldAdapter
          ? {
              ldAdapter: {
                type: 'PlinkLDAdapter',
                uri: 'https://example.com/x.ld',
              },
            }
          : {}),
      },
    },
    displayName: 'LinearManhattanDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    displayConfig: color === undefined ? {} : { color },
    regions: REGIONS,
    onViewReady: view => {
      view.showAllRegions()
    },
  })

  return { createDisplay: env.createDisplay, mockRpcCall: env.mockRpcCall }
}
