import { resolveSubMenu } from '@jbrowse/core/ui'

import { recordsBandSurface } from './components/RecordsBandOverlay.tsx'
import { variantSurfaceHandlers } from './components/variantSurface.ts'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'

import type { LinearVariantDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// the fetch that brought the records marks their region loaded
function sitesOnlyDisplay(loadedStart = 0) {
  const { display } = recordsDisplayAt(KIT, 51, {}, false)
  const region = display.view.displayedRegions[0]!
  display.setLoadedRegion(
    0,
    { ...region, start: loadedStart, end: 100_000 },
    undefined,
  )
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

// through the surface's own right-click handler, which reads the tooltip
function rightClickThroughSurface(
  display: LinearVariantDisplayModel,
  id: string,
) {
  const item = display.recordsLaidOutDataMap
    .get(0)!
    .flatbushItems.find(i => i.featureId === id)!
  const { bpPerPx, offsetPx } = display.view
  const surface = recordsBandSurface(display)
  variantSurfaceHandlers(display, surface).onContextMenu({
    clientX: ((item.startBp + item.endBp) / 2 - offsetPx * bpPerPx) / bpPerPx,
    clientY: (item.topPx + item.bottomPx) / 2,
    currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    preventDefault: () => {},
  } as never)
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

  test('offers no row sort, since no row draws', () => {
    const display = sitesOnlyDisplay()
    expect(labels(rightClickRecord(display, '>7494>7499'))).not.toContain(
      'Sort rows by genotype here',
    )
  })

  test('copies the tooltip the record shows', () => {
    const display = sitesOnlyDisplay()
    const copy = row(
      rightClickThroughSurface(display, '>7494>7499'),
      'Copy to clipboard',
    )
    expect('subMenu' in copy && labels(resolveSubMenu(copy))).toContain(
      'Copy tooltip text',
    )
  })

  test('offers no tooltip to copy with the tooltip off', () => {
    const { display } = recordsDisplayAt(KIT, 51, {}, false, {
      tooltip: { show: false },
    })
    const region = display.view.displayedRegions[0]!
    display.setLoadedRegion(0, { ...region, start: 0, end: 100_000 }, undefined)
    const copy = row(
      rightClickThroughSurface(display, '>7494>7499'),
      'Copy to clipboard',
    )
    expect('subMenu' in copy && labels(resolveSubMenu(copy))).not.toContain(
      'Copy tooltip text',
    )
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

  test('a record starting before the loaded span keeps its record rows', () => {
    const display = sitesOnlyDisplay(30_000)
    expect(labels(rightClickThroughSurface(display, '>7494>7499'))).toEqual(
      expect.arrayContaining(['Zoom to variant', 'Copy to clipboard']),
    )
  })

  test('a hit that names no region is found in the loaded region holding its start', () => {
    const display = sitesOnlyDisplay()
    const region = display.view.displayedRegions[0]!
    display.setLoadedRegion(0, { ...region, start: 0, end: 10_000 }, undefined)
    display.setLoadedRegion(
      2,
      { ...region, start: 20_000, end: 100_000 },
      undefined,
    )
    const feature = display.featureById('>7496>7497')!
    expect(display.recordMenuHit(feature)?.displayedRegionIndex).toBe(2)
    expect(display.recordMenuHit(feature, 0)?.displayedRegionIndex).toBe(0)
  })

  test('a hit that names no region finds the loaded region a record starting before it overlaps', () => {
    const display = sitesOnlyDisplay(30_000)
    const feature = display.featureById('>7494>7499')!
    expect(feature.get('start')).toBeLessThan(30_000)
    expect(display.recordMenuHit(feature)?.displayedRegionIndex).toBe(0)
  })

  test('a hit that names no region finds none for a record clear of every loaded region', () => {
    const display = sitesOnlyDisplay(30_000)
    const feature = display.featureById('>7493>7494')!
    expect(display.recordMenuHit(feature)).toBeUndefined()
  })

  test('a record the view holds no reads beside offers no read sort', () => {
    const display = sitesOnlyDisplay()
    expect(labels(rightClickRecord(display, '>7494>7499'))).not.toContain(
      'Sort reads at this variant',
    )
  })
})
