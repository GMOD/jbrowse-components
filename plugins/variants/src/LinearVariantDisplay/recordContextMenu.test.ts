import { resolveSubMenu } from '@jbrowse/core/ui'

import { recordsBandSurface } from './components/RecordsBandOverlay.tsx'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'

import type { LinearVariantDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// the fetch that brought the records marks their region loaded
function sitesOnlyDisplay() {
  const { display } = recordsDisplayAt(KIT, 51, {}, false)
  const region = display.view.displayedRegions[0]!
  display.setLoadedRegion(0, { ...region, start: 0, end: 100_000 }, undefined)
  return display
}

function rightClickRecord(display: LinearVariantDisplayModel, id: string) {
  const item = display.recordsLaidOutDataMap
    .get(0)!
    .flatbushItems.find(i => i.featureId === id)!
  const { bpPerPx, offsetPx } = display.view
  const surface = recordsBandSurface(display)
  const hit = surface.getHit(
    ((item.startBp + item.endBp) / 2 - offsetPx * bpPerPx) / bpPerPx,
    (item.topPx + item.bottomPx) / 2,
  )!
  display.openContextMenu({
    feature: surface.enrich(hit)!,
    clientX: 0,
    clientY: 0,
  })
  return display.contextMenuItems()
}

function labels(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : i.type))
}

function row(items: MenuItem[], label: string) {
  const found = items.find(i => 'label' in i && i.label === label)
  if (!found) {
    throw new Error(`no "${label}" row in ${labels(items).join(', ')}`)
  }
  return found
}

// A sites-only VCF draws its records alone, so right-clicking one is how its
// reader reaches what LinearBasicDisplay's feature menu offered on it.
describe('right-clicking a record, with no sample rows', () => {
  test("offers the feature track's record rows", () => {
    const display = sitesOnlyDisplay()
    const items = rightClickRecord(display, '>7494>7499')
    expect(labels(items)).toEqual(
      expect.arrayContaining([
        'Open variant details',
        'Zoom to variant',
        'Get sequence...',
        'Copy to clipboard',
      ]),
    )
    const copy = row(items, 'Copy to clipboard')
    expect('subMenu' in copy && labels(resolveSubMenu(copy))).toEqual([
      'Copy location',
      'Copy >7494>7499 attributes (JSON)',
    ])
  })

  test('zoom to goes to the record', () => {
    const display = sitesOnlyDisplay()
    const zoom = row(rightClickRecord(display, '>7496>7497'), 'Zoom to variant')
    if ('onClick' in zoom) {
      zoom.onClick()
    }
    const [region] = display.view.visibleRegions
    expect(region!.start).toBeLessThanOrEqual(24561)
    expect(region!.end).toBeGreaterThanOrEqual(24562)
    expect(region!.end - region!.start).toBeLessThan(100)
  })

  test('a record the view holds no reads beside offers no read sort', () => {
    const display = sitesOnlyDisplay()
    expect(labels(rightClickRecord(display, '>7494>7499'))).not.toContain(
      'Sort reads at this variant',
    )
  })
})
