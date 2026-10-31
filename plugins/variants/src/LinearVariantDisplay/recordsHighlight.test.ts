import { recordsBandSurface } from './components/RecordsBandOverlay.tsx'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'

import type { LinearVariantDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

function bandItem(display: LinearVariantDisplayModel, id: string) {
  return display.recordsLaidOutDataMap
    .get(0)!
    .flatbushItems.find(i => i.featureId === id)!
}

function rightClick(display: LinearVariantDisplayModel, id: string) {
  const item = bandItem(display, id)
  const { bpPerPx, offsetPx } = display.view
  const surface = recordsBandSurface(display)
  const hit = surface.getHit(
    (item.startBp + item.endBp) / 2 / bpPerPx - offsetPx,
    (item.topPx + item.bottomPx) / 2,
  )!
  display.openContextMenu({
    feature: surface.enrich(hit)!,
    clientX: 0,
    clientY: 0,
  })
  return display.contextMenuItems()
}

function clickRow(items: MenuItem[], label: string) {
  const row = items.find(i => 'label' in i && i.label === label)
  if (!row || !('onClick' in row)) {
    throw new Error(`no "${label}" row`)
  }
  row.onClick()
}

function sitesOnly() {
  const { display } = recordsDisplayAt(KIT, 51, {}, false)
  const region = display.view.displayedRegions[0]!
  display.setLoadedRegion(0, { ...region, start: 0, end: 100_000 }, undefined)
  return display
}

// A search hit names a record by its span and name, as the text index
// records it; the band boxes the record it resolves to, over its glyph and
// its labels, the box a hover lights.
test('a search hit boxes the record on the band', () => {
  const display = sitesOnly()
  const item = bandItem(display, '>7496>7497')
  display.setSearchHighlight({
    refName: 'ctgA',
    start: item.startBp,
    end: item.endBp,
    name: '>7496>7497',
  })
  expect([...display.highlightedFeatureIdSet]).toEqual(['>7496>7497'])
  const surface = recordsBandSurface(display)
  surface.onHover?.(
    surface.getHit(
      (item.startBp + item.endBp) / 2 / display.view.bpPerPx -
        display.view.offsetPx,
      (item.topPx + item.bottomPx) / 2,
    ),
  )
  expect(display.pinnedInk).toEqual(display.hoverInk)
  expect(display.pinnedInk).toMatchObject([{ top: item.topPx }])
  expect(display.pinnedInk[0]!.width).toBeGreaterThan(60)
  display.clearFeatureHighlights()
  expect(display.pinnedInk).toEqual([])
})

test("a record's Highlight row boxes it, and the same row takes it off", () => {
  const display = sitesOnly()
  clickRow(rightClick(display, '>7494>7499'), 'Highlight variant')
  expect([...display.highlightedFeatureIdSet]).toEqual(['>7494>7499'])
  expect(display.featureHighlights[0]?.featureId).toBe('>7494>7499')
  clickRow(rightClick(display, '>7494>7499'), 'Remove highlight')
  expect(display.featureHighlights.length).toBe(0)
})
