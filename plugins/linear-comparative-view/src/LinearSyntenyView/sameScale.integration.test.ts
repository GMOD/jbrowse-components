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
  await when(() => view.init === undefined, { timeout: 15000 })
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
  const coarsest = large!.maxBpPerPx

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

// The shared scale is past the small row's own maxBpPerPx, which is the whole
// point and also why it can't go through zoomTo: that clamp is what pulls a
// small genome back out to full pane width.
test('the shared scale is one zoomTo would refuse', async () => {
  const view = await launch({ views })
  const [small] = view.views
  const coarsest = Math.max(...view.views.map(v => v.maxBpPerPx))

  expect(coarsest).toBeGreaterThan(small!.maxBpPerPx)
  small!.zoomTo(coarsest)
  expect(small!.bpPerPx).toBeCloseTo(small!.maxBpPerPx)
})

// setDisplayedRegions re-clamps bpPerPx into the row's own range, so anything
// that rewrites a row's regions — autoDiagonalize is the one that does, on
// every row it reorders — undoes the shared scale. That is why applyInit runs
// sameScale last rather than folding it in with the other init settings.
test('rewriting a row regions drops it back off the shared scale', async () => {
  const view = await launch({ views })
  const [small] = view.views

  view.showAllRegionsSameScale()
  small!.setDisplayedRegions([...small!.displayedRegions])

  expect(small!.bpPerPx).toBeCloseTo(small!.maxBpPerPx)
})

test('init.sameScale applies the shared scale on load', async () => {
  const view = await launch({ views, sameScale: true })
  const [small, large] = view.views

  expect(small!.bpPerPx).toBeCloseTo(large!.bpPerPx)
  expect(small!.displayedRegionsTotalPx).toBeCloseTo(
    (800 * 0.9 * SMALL_BP) / LARGE_BP,
  )
})
