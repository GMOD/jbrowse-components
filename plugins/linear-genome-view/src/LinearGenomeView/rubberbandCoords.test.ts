import { createTestSession } from '@jbrowse/web/testUtils'

import {
  buildRubberBandMenuItems,
  buildRubberbandClickMenuItems,
} from './menuItems.ts'

import type { LinearGenomeViewModel } from './index.ts'
import type { MenuItem } from '@jbrowse/core/ui'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const mockCopyText = jest.fn()
jest.mock('@jbrowse/core/util/copyText', () => ({
  copyText: (...args: unknown[]) => mockCopyText(...args),
}))

beforeEach(() => {
  mockCopyText.mockClear()
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// `pxToBp().coord` is 1-based (`regionBase0() + 1`), and `bpToPx` — which
// `centerAt` calls — is documented as taking the 0-based BED-style coord. The
// rubberband menus are the one place both conventions meet.
function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10000 },
        ],
      },
    },
  })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 10000 },
    ],
  }) as LinearGenomeViewModel
  view.setWidth(800)
  view.zoomTo(1)
  view.scrollTo(0)
  return { session, view }
}

// MenuItem is a union — dividers carry no label, custom items no onClick
function clickable(items: MenuItem[]) {
  return items.flatMap(item =>
    'label' in item && typeof item.label === 'string' && 'onClick' in item
      ? [{ label: item.label, onClick: item.onClick }]
      : [],
  )
}

function labelOf(items: MenuItem[], startsWith: string) {
  return clickable(items).find(i => i.label.startsWith(startsWith))?.label
}

function clickItem(items: MenuItem[], label: string) {
  clickable(items)
    .find(i => i.label === label)
    ?.onClick()
}

function clickAt(view: LinearGenomeViewModel, px: number) {
  return buildRubberbandClickMenuItems(view, view.pxToBp(px))
}

test('the clicked base is the one the copied coordinate names', () => {
  const { view } = setup()
  // bpPerPx 1, offsetPx 0: px 500 paints the base spanning 0-based [500,501),
  // which is base 501 counting from one
  expect(view.pxToBp(500).coord).toBe(501)
  expect(labelOf(clickAt(view, 500), 'Copy coordinate')).toBe(
    'Copy coordinate (ctgA:501)',
  )
})

test('"Center view here" centers the base that was clicked', () => {
  const { view } = setup()
  const clicked = view.pxToBp(500).coord
  clickItem(clickAt(view, 500), 'Center view here')
  expect(view.pxToBp(view.width / 2).coord).toBe(clicked)
})

test('"Zoom to base level" centers the base that was clicked', () => {
  const { view } = setup()
  const clicked = view.pxToBp(500).coord
  clickItem(clickAt(view, 500), 'Zoom to base level')
  expect(view.pxToBp(view.width / 2).coord).toBe(clicked)
})

test('"Copy range" names the first and last selected bases', () => {
  const { view } = setup()
  view.setOffsets(view.pxToBp(100), view.pxToBp(200))
  clickItem(buildRubberBandMenuItems(view, []), 'Copy range')
  // the selection covers 0-based [100,200) — bases 101..200 counting from one,
  // which is the region `Zoom to region` navigates to
  expect(mockCopyText).toHaveBeenCalledWith(view, 'ctgA:101-200', 'range')
})
