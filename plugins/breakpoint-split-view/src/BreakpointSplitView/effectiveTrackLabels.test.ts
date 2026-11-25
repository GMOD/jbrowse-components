import { createTestSession } from '@jbrowse/web/testUtils'

import type { BreakpointViewModel } from './model.ts'
import type { ViewTrackLabelMode } from '@jbrowse/plugin-linear-genome-view'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const REGION = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 50_000,
}

async function labelsOfPanels(modes: ViewTrackLabelMode[]) {
  const view = (await createTestSession().launchView('BreakpointSplitView', {
    views: modes.map(() => ({
      type: 'LinearGenomeView',
      displayedRegions: [REGION],
    })),
  })) as BreakpointViewModel
  for (const [i, panel] of view.views.entries()) {
    panel.setTrackLabels(modes[i]!)
  }
  return view.effectiveTrackLabels
}

test('panels that agree on a label mode give that mode', async () => {
  expect(await labelsOfPanels(['hidden', 'hidden'])).toBe('hidden')
  expect(await labelsOfPanels(['overlapping', 'overlapping'])).toBe(
    'overlapping',
  )
})

test('panels that differ give offset', async () => {
  expect(await labelsOfPanels(['hidden', 'overlapping'])).toBe('offset')
})
