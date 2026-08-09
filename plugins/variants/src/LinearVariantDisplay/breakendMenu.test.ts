import {
  getAssemblyName,
  hasBreakpointSplitView,
  launchBreakpointSplitView,
} from '@jbrowse/sv-core'

import { breakendMenuItems } from './breakendMenu.ts'
import { SPLIT_VIEW_MENU_LABEL } from './labels.ts'

// Only the three functions the module imports, so nothing else in sv-core has
// to load: the dialog it launches is React and pulls the whole comparative
// stack behind it.
jest.mock('@jbrowse/sv-core', () => ({
  hasBreakpointSplitView: jest.fn(() => true),
  launchBreakpointSplitView: jest.fn(),
  getAssemblyName: jest.fn(() => 'hg38'),
  junctionFromFeature: jest.fn(),
  // the module now also supplies the callset reader the dialog needs to offer
  // "Follow further breakends"; the row just hands it along
  makeFindJunctionsNear: jest.fn(() => jest.fn()),
}))

jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getSession: () => ({ id: 'session' }),
  getContainingView: () => ({ id: 'view' }),
}))

// The post-await liveness guard is the one thing here that insists on a real
// tree node; everything else the item touches is passed in.
jest.mock('@jbrowse/mobx-state-tree', () => ({
  ...jest.requireActual('@jbrowse/mobx-state-tree'),
  isAlive: () => true,
}))

function fakeSelf({
  type,
  feature,
}: {
  type: string | undefined
  feature?: unknown
}) {
  const fetchFullFeature = jest.fn().mockResolvedValue(feature)
  return {
    contextMenuInfo:
      type === undefined
        ? undefined
        : {
            item: { featureId: 'r_12_1', type },
            displayedRegionIndex: 0,
          },
    fetchFullFeature,
    // what makeFindJunctionsNear queries; the mock below never calls it
    adapterConfig: { type: 'VcfTabixAdapter' },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(hasBreakpointSplitView).mockReturnValue(true)
  jest.mocked(getAssemblyName).mockReturnValue('hg38')
})

test('no row without a right-click', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(breakendMenuItems(fakeSelf({ type: undefined }) as any)).toEqual([])
})

test('no row on a record that has no mate', () => {
  // A plain SNV opens the same dialog to nothing, so it must not offer it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(breakendMenuItems(fakeSelf({ type: 'SNV' }) as any)).toEqual([])
})

test('no row when the session has no BreakpointSplitView', () => {
  jest.mocked(hasBreakpointSplitView).mockReturnValue(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(breakendMenuItems(fakeSelf({ type: 'breakend' }) as any)).toEqual([])
})

test('one row on a breakend, which launches with the refetched feature', async () => {
  const feature = { id: () => 'r_12_1' }
  const self = fakeSelf({ type: 'breakend', feature })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = breakendMenuItems(self)
  expect(items.map(i => ('label' in i ? i.label : undefined))).toEqual([
    SPLIT_VIEW_MENU_LABEL,
  ])

  const item = items[0]!
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(item as any).onClick()
  await Promise.resolve()
  await Promise.resolve()

  // the slim hit item is not what the dialog resolves a mate from
  expect(self.fetchFullFeature).toHaveBeenCalledWith('r_12_1', 0)
  expect(jest.mocked(launchBreakpointSplitView)).toHaveBeenCalledWith(
    expect.objectContaining({ feature, assemblyName: 'hg38' }),
  )
  // and it hands the dialog a way to read the callset, which is what turns
  // "Follow further breakends at each end" on in there
  expect(
    jest.mocked(launchBreakpointSplitView).mock.calls[0]![0].findJunctionsNear,
  ).toEqual(expect.any(Function))
})
