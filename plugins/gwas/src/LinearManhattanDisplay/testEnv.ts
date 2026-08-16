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

// The shared display harness wired for the Manhattan display.
export function createTestEnvironment() {
  const env = createDisplayTestEnvironment<LinearManhattanDisplayModel>({
    plugins: [new LinearGenomeViewPlugin()],
    trackType: 'GWASTrack',
    adapter: {
      name: 'GWASAdapter',
      slots: { ldAdapter: { type: 'frozen', defaultValue: null } },
      config: {
        type: 'GWASAdapter',
        ldAdapter: { type: 'PlinkLDAdapter', uri: 'https://example.com/x.ld' },
      },
    },
    displayName: 'LinearManhattanDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    regions: REGIONS,
    onViewReady: view => {
      view.showAllRegions()
    },
  })

  function createDisplay({
    colorBy = 'normal',
  }: { colorBy?: 'normal' | 'ld' } = {}) {
    const made = env.createDisplay()
    if (colorBy !== 'normal') {
      // colorBy is a config slot, so it has to be written through the action
      // rather than passed in the display snapshot
      made.display.setColorBy(colorBy)
    }
    return made
  }

  return { createDisplay, mockRpcCall: env.mockRpcCall }
}
