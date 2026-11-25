import { createTestSession } from '@jbrowse/web/testUtils'

import type { LinearSyntenyViewModel } from './model.ts'
import type { ViewTrackLabelMode } from '@jbrowse/plugin-linear-genome-view'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function labelsOfRows(modes: ViewTrackLabelMode[]) {
  const view = (await createTestSession().launchView('LinearSyntenyView', {
    views: modes.map(() => ({ type: 'LinearGenomeView' })),
  })) as LinearSyntenyViewModel
  for (const [i, row] of view.views.entries()) {
    row.setTrackLabels(modes[i]!)
  }
  return view.effectiveTrackLabels
}

test('rows that agree on a label mode give that mode', async () => {
  expect(await labelsOfRows(['hidden', 'hidden', 'hidden'])).toBe('hidden')
  expect(await labelsOfRows(['overlapping', 'overlapping'])).toBe('overlapping')
})

test('rows that differ give offset', async () => {
  expect(await labelsOfRows(['overlapping', 'overlapping', 'hidden'])).toBe(
    'offset',
  )
})
