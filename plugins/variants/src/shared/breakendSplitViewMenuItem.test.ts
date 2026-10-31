import { SimpleFeature } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { launchBreakpointSplitView } from '@jbrowse/sv-core'

import { breakendSplitViewMenuItem } from './breakendSplitViewMenuItem.ts'

jest.mock('@jbrowse/sv-core', () => ({
  getAssemblyName: () => 'volvox',
  hasBreakpointSplitView: () => true,
  launchBreakpointSplitView: jest.fn(),
  makeFindJunctionsNear: () => () => Promise.resolve([]),
}))
jest.mock('@jbrowse/plugin-linear-genome-view', () => ({
  containingLgv: () => ({}),
}))
jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getSession: () => ({}),
}))

const clicked = new SimpleFeature({
  uniqueId: 'bnd1',
  refName: 'ctgA',
  start: 100,
  end: 101,
  type: 'breakend',
  ALT: ['N[ctgB:500['],
})
const full = new SimpleFeature({
  ...clicked.toJSON(),
  INFO: { MATEID: ['bnd2'], EVENT: ['ev1'] },
})

// the click's record is the cell payload's, with no INFO, and the junction
// walk follows MATEID and EVENT off the record it launches from
test('the split view launches from the full record, INFO included', async () => {
  const fetchFullRecord = jest.fn(() => Promise.resolve(full))
  const self = types
    .model({})
    .volatile(() => ({ adapterConfig: {} }))
    .actions(() => ({ fetchFullRecord }))
    .create()
  const [item] = breakendSplitViewMenuItem(self, clicked)
  if (!item || !('onClick' in item)) {
    throw new Error('no split view row')
  }
  item.onClick()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(fetchFullRecord).toHaveBeenCalledWith(clicked)
  const args = jest.mocked(launchBreakpointSplitView).mock.calls[0]![0]
  expect(args.feature.get('INFO')).toEqual({
    MATEID: ['bnd2'],
    EVENT: ['ev1'],
  })
})
