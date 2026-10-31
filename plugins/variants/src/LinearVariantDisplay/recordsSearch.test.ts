import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'

import type { LinearVariantDisplayModel } from './model.ts'

// The breakpoint split view's overlay finds a record with
// `searchFeatureByID` and draws it at `top - scrollTop`, so the answer has to
// land on the box the band painted whichever part of the display scrolls.
function bandItem(display: LinearVariantDisplayModel, id: string) {
  return display.recordsLaidOutDataMap
    .get(0)!
    .flatbushItems.find(i => i.featureId === id)!
}

function drawnTop(display: LinearVariantDisplayModel, id: string) {
  return display.searchFeatureByID(id)![1] - display.scrollTop
}

test('a record is found where the band drew it, over rows', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  expect(display.layoutReady).toBe(true)
  const item = bandItem(display, '>7494>7499')
  expect(display.searchFeatureByID('>7494>7499')).toEqual([
    item.startBp,
    item.topPx,
    item.endBp,
    item.bottomPx,
  ])
})

test('the rows scrolling leave the band, and the answer, where they were', () => {
  // one row taller than the display, so the rows scroll
  const { display } = recordsDisplayAt(KIT, 51, {}, true, { rowHeight: 600 })
  const item = bandItem(display, '>7494>7499')
  display.setScrollTop(40)
  expect(display.scrollTop).toBe(40)
  expect(drawnTop(display, '>7494>7499')).toBe(item.topPx)
})

test('with no rows the band is what scrolls', () => {
  const { display } = recordsDisplayAt(KIT, 51, {}, false, {
    heightMode: 'fixed',
    height: 30,
  })
  const item = bandItem(display, '>7494>7499')
  display.setScrollTop(20)
  expect(display.scrollTop).toBe(20)
  expect(drawnTop(display, '>7494>7499')).toBe(item.topPx - 20)
})

test('a record the band does not draw is not found, and no band is no layout', () => {
  const { display } = recordsDisplayAt(KIT, 51, { show: false })
  expect(display.layoutReady).toBe(false)
  expect(display.searchFeatureByID('>7494>7499')).toBeUndefined()
})
