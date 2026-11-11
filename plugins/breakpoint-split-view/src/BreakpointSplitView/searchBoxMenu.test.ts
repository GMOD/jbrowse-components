import { createTestSession } from '@jbrowse/web/testUtils'

import type { BreakpointViewModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const REGION = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 50_000,
}

function flatten(items: MenuItem[]): MenuItem[] {
  return items.flatMap(item =>
    'subMenu' in item ? [item, ...flatten(item.subMenu)] : [item],
  )
}

function searchBoxRows(view: BreakpointViewModel) {
  return flatten(view.menuItems()).filter(
    item =>
      'label' in item &&
      (item.label === 'Show search boxes' ||
        item.label === 'Search box orientation'),
  )
}

test('the search-box rows disable while the header they act on is hidden', async () => {
  const view = (await createTestSession().launchView('BreakpointSplitView', {
    views: [
      { type: 'LinearGenomeView', displayedRegions: [REGION] },
      { type: 'LinearGenomeView', displayedRegions: [REGION] },
    ],
  })) as BreakpointViewModel
  for (const v of view.views) {
    v.setWidth(800)
    v.setWindow(8000, 10_000)
  }
  expect(searchBoxRows(view).map(row => row.disabled)).toEqual([false, false])
  view.setShowHeader(false)
  expect(searchBoxRows(view).map(row => row.disabled)).toEqual([true, true])
})
