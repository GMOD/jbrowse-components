import {
  createDisplayTestEnvironment,
  stageByteEstimate,
} from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'

import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'

import type { LinearMarkDisplayModel } from './model.ts'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 8_000_000,
  assemblyName: 'volvox',
}

function createDisplay() {
  return createDisplayTestEnvironment<LinearMarkDisplayModel>({
    plugins: [new LinearGenomeViewPlugin(), new WigglePlugin()],
    trackType: 'FeatureTrack',
    adapter: { name: 'BedAdapter', config: { type: 'BedAdapter' } },
    displayName: 'LinearMarkDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    displayConfig: {
      marks: [
        { mark: 'bar', encoding: { y: 'score' } },
        {
          mark: 'bar',
          transform: [
            { type: 'bin', step: 'auto' },
            { type: 'aggregate', ops: [{ op: 'count' }] },
          ],
          minBpPerPx: 100,
        },
      ],
    },
    regions: [REGION],
    assemblyRegions: [REGION],
    onViewReady: view => {
      view.showAllRegions()
    },
  }).createDisplay()
}

// The mark display is byte-gated like every feature display: a fetch over the
// budget shows the banner, and the banner is a terminal the display and its
// export both stop waiting at.
test('a refused fetch shows the banner and counts as painted', () => {
  const { display, view } = createDisplay()
  view.zoomTo(2000)
  stageByteEstimate(display, 50_000_000)
  expect(display.regionTooLarge).toBe(true)
  expect(display.displayPhase).toBe('tooLarge')
  expect(display.svgReady).toBe(true)
  expect(display.painted).toBe(true)
})

test('a fetch inside the budget shows no banner', () => {
  const { display, view } = createDisplay()
  view.zoomTo(2000)
  stageByteEstimate(display, 1_000)
  expect(display.regionTooLarge).toBe(false)
  expect(display.displayPhase).not.toBe('tooLarge')
})
