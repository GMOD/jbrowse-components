import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { act, render, screen } from '@testing-library/react'

import WidgetHeading from '../../../../../packages/product-core/src/ui/WidgetHeading.tsx'
import conf from '../../../../../test_data/test_order/config.json' with { type: 'json' }

import type { HierarchicalTrackSelectorModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function renderHeading(model: HierarchicalTrackSelectorModel) {
  const { pluginManager } = getEnv(model)
  return render(<WidgetHeading pluginManager={pluginManager} widget={model} />)
}

test('heading follows the associated view when it is renamed or switched', () => {
  const session = createTestSession()
  const first = session.addView('LinearGenomeView', {
    displayName: 'Reference',
  })
  const second = session.addView('LinearGenomeView', {
    displayName: 'Comparison',
  })
  const model = first.activateTrackSelector() as HierarchicalTrackSelectorModel

  renderHeading(model)
  expect(screen.getByRole('heading').textContent).toBe(
    'Reference — Available tracks',
  )

  act(() => {
    first.setDisplayName('Renamed reference')
  })
  expect(screen.getByRole('heading').textContent).toBe(
    'Renamed reference — Available tracks',
  )

  act(() => {
    second.activateTrackSelector()
  })
  expect(screen.getByRole('heading').textContent).toBe(
    'Comparison — Available tracks',
  )
})

test('an unnamed view uses its assembly display name', () => {
  const session = createTestSession({
    jbrowseConfig: {
      assemblies: [{ ...conf.assemblies[0], displayName: 'Volvox genome' }],
    },
  })
  const view = session.addView('LinearGenomeView', {
    displayName: '',
    displayedRegions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  renderHeading(view.activateTrackSelector() as HierarchicalTrackSelectorModel)
  expect(screen.getByRole('heading').textContent).toBe(
    'Volvox genome — Available tracks',
  )
})

test('a selector without an associated view retains the generic heading', () => {
  const session = createTestSession()
  const view = session.addView('LinearGenomeView', {
    displayName: 'Reference',
  })
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  renderHeading(model)

  act(() => {
    model.setView(undefined)
  })
  expect(screen.getByRole('heading').textContent).toBe('Available tracks')
})
