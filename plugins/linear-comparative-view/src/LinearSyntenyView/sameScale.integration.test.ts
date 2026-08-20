import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Two assemblies an order of magnitude apart in size, which is what the shared
// scale exists to show: fit individually, both rows are drawn the same width
// and the small genome is silently stretched 10x to match the large one.
const SMALL_BP = 16000
const LARGE_BP = 160000

const assembly = (name: string, length: number) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: length,
          seq: 'a'.repeat(length),
        },
      ],
    },
  },
})

function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('small', SMALL_BP))
  session.addAssemblyConf(assembly('large', LARGE_BP))
  return session
}

const views = [{ assembly: 'small' }, { assembly: 'large' }]

async function launch(init: Record<string, unknown>) {
  const session = setup()
  const view = session.addView('LinearSyntenyView', {
    init,
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.init === undefined)
  return view
}

test('rows fit individually are drawn the same width whatever their size', async () => {
  const view = await launch({ views })
  const [small, large] = view.views

  expect(small!.bpPerPx).not.toBeCloseTo(large!.bpPerPx)
  expect(small!.displayedRegionsTotalPx).toBeCloseTo(
    large!.displayedRegionsTotalPx,
  )
})

test('showAllRegionsSameScale puts every row on the largest row scale', async () => {
  const view = await launch({ views })
  const [small, large] = view.views
  const coarsest = large!.fitBpPerPx

  view.showAllRegionsSameScale()

  expect(small!.bpPerPx).toBeCloseTo(coarsest)
  expect(large!.bpPerPx).toBeCloseTo(coarsest)
  // the large genome still fills its pane, and the small one is now drawn
  // shorter by exactly its share of the bp — the size difference the
  // fit-to-width version hid
  expect(large!.displayedRegionsTotalPx).toBeCloseTo(800 * 0.9)
  expect(small!.displayedRegionsTotalPx).toBeCloseTo(
    (800 * 0.9 * SMALL_BP) / LARGE_BP,
  )
})

// The shared scale is past the small row's own FIT, which is the whole point.
// It survives a zoom because it moves the row's LIMIT: written past the limit
// instead, the first thing to clamp would pull the small genome back out to
// full pane width.
test('the shared scale raises the small row zoom-out limit', async () => {
  const view = await launch({ views })
  const [small] = view.views
  const coarsest = Math.max(...view.views.map(v => v.fitBpPerPx))

  expect(coarsest).toBeGreaterThan(small!.fitBpPerPx)
  view.showAllRegionsSameScale()

  expect(small!.maxBpPerPx).toBeCloseTo(coarsest)
  small!.zoomTo(coarsest)
  expect(small!.bpPerPx).toBeCloseTo(coarsest)
})

// Every route to a zoom clamps against the same raised ceiling, so zooming the
// small row all the way out LANDS on the shared scale rather than on its own
// fit — which is what makes the state reachable again after a zoom in.
test('zooming the small row out lands back on the shared scale', async () => {
  const view = await launch({ views })
  const [small] = view.views

  view.showAllRegionsSameScale()
  const shared = small!.bpPerPx
  small!.zoomTo(shared / 8)
  small!.zoomTo(Number.MAX_SAFE_INTEGER)

  expect(small!.bpPerPx).toBeCloseTo(shared)
})

// setDisplayedRegions re-clamps bpPerPx into the row's range, and autoDiagonalize
// rewrites the regions of every row it reorders. With the ceiling raised that
// clamp is a no-op, where it used to drop the row back to fit-to-width.
test('rewriting a row regions keeps it on the shared scale', async () => {
  const view = await launch({ views })
  const [small] = view.views

  view.showAllRegionsSameScale()
  const shared = small!.bpPerPx
  small!.setDisplayedRegions([...small!.displayedRegions])

  expect(small!.bpPerPx).toBeCloseTo(shared)
})

// The mode is a property so a saved session keeps it; the ceiling it implies is
// volatile on each row, re-derived from the rows' own fits by the autorun.
test('the mode is saved, the ceiling it implies is not', async () => {
  const view = await launch({ views })
  view.showAllRegionsSameScale()

  const snap = getSnapshot(view)
  expect(snap.sameScale).toBe(true)
  expect(snap.views[0]).not.toHaveProperty('sharedFitBpPerPx')
})

// Back to each row filling its own pane, which is the way off the mode.
test('show all regions hands each row back its own fit', async () => {
  const view = await launch({ views, sameScale: true })
  const [small, large] = view.views

  view.showAllRegions()

  expect(view.sameScale).toBe(false)
  expect(small!.maxBpPerPx).toBeCloseTo(small!.fitBpPerPx)
  expect(small!.displayedRegionsTotalPx).toBeCloseTo(
    large!.displayedRegionsTotalPx,
  )
})

test('init.sameScale applies the shared scale on load', async () => {
  const view = await launch({ views, sameScale: true })
  const [small, large] = view.views

  expect(small!.bpPerPx).toBeCloseTo(large!.bpPerPx)
  expect(small!.displayedRegionsTotalPx).toBeCloseTo(
    (800 * 0.9 * SMALL_BP) / LARGE_BP,
  )
})
