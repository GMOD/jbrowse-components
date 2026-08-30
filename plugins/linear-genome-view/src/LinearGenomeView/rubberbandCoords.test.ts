import { createTestSession } from '@jbrowse/web/testUtils'

import {
  buildRubberBandMenuItems,
  buildRubberbandClickMenuItems,
} from './menuItems.ts'

import type { LinearGenomeViewModel } from './index.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util/types'

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

const WHOLE_CONTIG: Region[] = [
  { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 10000 },
]

// `pxToBp().coord` is 1-based (`regionBase0() + 1`), and `bpToPx` — which
// `centerAt` calls — is documented as taking the 0-based BED-style coord. The
// rubberband menus are the one place both conventions meet.
function setup(displayedRegions = WHOLE_CONTIG, width = 800) {
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
    displayedRegions,
  }) as LinearGenomeViewModel
  view.setWidth(width)
  view.zoomTo(1)
  view.scrollTo(0)
  return { session, view }
}

function copiedRange(
  view: LinearGenomeViewModel,
  leftPx: number,
  rightPx: number,
) {
  view.setOffsets(view.pxToBp(leftPx), view.pxToBp(rightPx))
  mockCopyText.mockClear()
  clickItem(buildRubberBandMenuItems(view, []), 'Copy range')
  return mockCopyText.mock.calls[0]![1] as string
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
  // the selection covers 0-based [100,200) — bases 101..200 counting from one,
  // which is the region `Zoom to region` navigates to
  expect(copiedRange(view, 100, 200)).toBe('ctgA:101..200')
})

// A rubberband's two offsets are ordered by PIXEL, so on a reversed region the
// left one carries the higher coordinate. Arithmetic on `coord` therefore named
// the ends backwards AND one base outward at each end — a string that does not
// even round-trip through `parseLocString`, which read `ctgA:9,901-9,800` as
// {start: 9900, end: 9800}.
test('"Copy range" on a reversed region names the bases actually selected', () => {
  const { view } = setup([{ ...WHOLE_CONTIG[0]!, reversed: true }])
  expect(copiedRange(view, 100, 200)).toBe('ctgA:9,801..9,900')
})

test('"Copy coordinate" on a reversed region names the base under the pointer', () => {
  const { view } = setup([{ ...WHOLE_CONTIG[0]!, reversed: true }])
  // px 0 paints the contig's last base. `coord` names 10,001 there, which is
  // off the end of a 10,000 bp contig entirely.
  expect(labelOf(clickAt(view, 0), 'Copy coordinate')).toBe(
    'Copy coordinate (ctgA:10,000)',
  )
  expect(labelOf(clickAt(view, 100), 'Copy coordinate')).toBe(
    'Copy coordinate (ctgA:9,900)',
  )
})

test('"Center view here" on a reversed region centers the base the label names', () => {
  const { view } = setup([{ ...WHOLE_CONTIG[0]!, reversed: true }])
  // px 100 paints base 9,900 counting from one, 9899 0-based; centering the
  // base one past it is what the old `coord - 1` did
  clickItem(clickAt(view, 100), 'Center view here')
  const centered = view.bpToPx({ refName: 'ctgA', coord: 9899 })!
  expect(centered.offsetPx - view.offsetPx).toBeCloseTo(view.width / 2, 6)
})

// Two displayed regions with a collapsed intron between them. `Get sequence`
// and `Zoom to region` both read the same two offsets as two regions; a
// `leftRef === rightRef` test called them one, and emitted a range 50x the
// selection because it spanned the gap the view is not showing.
test('"Copy range" across a collapsed intron names both regions', () => {
  const { view } = setup(
    [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 100 },
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 5000, end: 5100 },
    ],
    200,
  )
  expect(copiedRange(view, 50, 150)).toBe('ctgA:51..100 ctgA:5,001..5,050')
})

// The menu closes before it runs the clicked item's callback, and a close is
// free to release the selection — the multi-level rubberband's does, which is
// what made its "Zoom to region(s)" silently no-op. These items read the
// offsets captured when they were built, so releasing in between changes
// nothing.
test('"Zoom to region" survives the selection being released on menu close', () => {
  const { view } = setup()
  const before = view.bpPerPx
  view.setOffsets(view.pxToBp(100), view.pxToBp(200))
  const items = buildRubberBandMenuItems(view, [])
  view.setOffsets(undefined, undefined)

  clickItem(items, 'Zoom to region')

  expect(view.bpPerPx).toBeLessThan(before)
})
