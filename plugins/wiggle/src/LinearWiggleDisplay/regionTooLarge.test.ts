import {
  createDisplayTestEnvironment,
  stageByteEstimate,
} from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearWiggleDisplayModel } from './model.ts'

const CHR23 = {
  refName: 'chr23',
  start: 0,
  end: 52_498_615,
  assemblyName: 'volvox',
}

const BOVINE_BUBBLES_CSI_ESTIMATE_FOR_ALL_OF_CHR23 = 1_791_179

function createDisplay() {
  return createDisplayTestEnvironment<LinearWiggleDisplayModel>({
    trackType: 'QuantitativeTrack',
    adapter: { name: 'MinigraphBubbleAdapter', configOnly: true },
    displayName: 'LinearWiggleDisplay',
    configSchema: () => configSchema,
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    regions: [CHR23],
    assemblyRegions: [CHR23],
    onViewReady: view => {
      view.showAllRegions()
    },
  }).createDisplay()
}

test('a whole chromosome of a tabix feature file draws as a quantitative track', () => {
  const { display } = createDisplay()
  expect(display.aboveForceLoadFloor).toBe(true)
  stageByteEstimate(display, BOVINE_BUBBLES_CSI_ESTIMATE_FOR_ALL_OF_CHR23)
  expect(display.regionTooLarge).toBe(false)
})

test('a quantitative track over a feature file still asks past the budget', () => {
  const { display } = createDisplay()
  stageByteEstimate(display, 50_000_000)
  expect(display.regionTooLarge).toBe(true)
})
