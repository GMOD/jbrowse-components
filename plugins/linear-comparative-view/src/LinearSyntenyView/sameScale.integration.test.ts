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

// two contigs each, so a `loc` naming one of them is a narrowing a reset would
// visibly throw away
const assembly = (name: string, length: number) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: ['ctgA', 'ctgB'].map(refName => ({
        refName,
        uniqueId: `${name}-${refName}`,
        start: 0,
        end: length,
        seq: 'a'.repeat(length),
      })),
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

async function launch(spec: Record<string, unknown>) {
  const session = setup()
  const view = session.addView(
    'LinearSyntenyView',
    spec,
  ) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.pendingLaunch === undefined)
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

test('showAllRegionsAcrossRows puts every row on the largest row scale', async () => {
  const view = await launch({ views })
  const [small, large] = view.views
  const coarsest = large!.fitBpPerPx

  view.showAllRegionsAcrossRows(true)

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
  view.showAllRegionsAcrossRows(true)

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

  view.showAllRegionsAcrossRows(true)
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

  view.showAllRegionsAcrossRows(true)
  const shared = small!.bpPerPx
  small!.setDisplayedRegions([...small!.displayedRegions])

  expect(small!.bpPerPx).toBeCloseTo(shared)
})

// The mode is a property so a saved session keeps it; the ceiling it implies is
// derived, never stored on a row, so there is nothing about it to persist.
test('the mode is saved, the ceiling it implies is not', async () => {
  const view = await launch({ views })
  view.showAllRegionsAcrossRows(true)

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

test('a flat sameScale applies the shared scale on load', async () => {
  const view = await launch({ views, sameScale: true })
  const [small, large] = view.views

  expect(small!.bpPerPx).toBeCloseTo(large!.bpPerPx)
  expect(small!.displayedRegionsTotalPx).toBeCloseTo(
    (800 * 0.9 * SMALL_BP) / LARGE_BP,
  )
})

// `sameScale` is a `replay` launch key: the flag lands on the declared property
// whichever way it is written, and the zoom onto the shared scale is the
// imperative half a launch adds. Flat used to give the latch and skip the zoom
// — the wrong picture, said nowhere — because only `init.sameScale` was read.
// Rows placed by their own `loc` are where the zoom is the whole of the work:
// with no loc a row's own show-all-regions already targets the ceiling the
// latched mode raises, so the flag alone looks right. Placed, nothing re-zooms
// them, and a flat spelling gave the latch, skipped `applySharedScale` and drew
// two rows at two scales under a menu that said "same bp per pixel".
const placed = [
  { assembly: 'small', loc: 'ctgB' },
  { assembly: 'large', loc: 'ctgB' },
]

test('the flat spelling re-fits, the nested one opens nothing', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const flat = await launch({ views: placed, sameScale: true })
  const nested = await launch({ init: { views: placed, sameScale: true } })
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('v5 removed'))
  warn.mockRestore()

  expect(flat.sameScale).toBe(true)
  expect(flat.views[0]!.bpPerPx).toBeCloseTo(flat.views[1]!.bpPerPx)
  expect(nested.views).toHaveLength(0)
  expect(nested.sameScale).toBe(false)
})

// The replay runs only where a launch blob does. Restoring a saved session
// means the rows are already where the user left them, and re-zooming them onto
// the shared scale would throw that away on every reload.
test('a restored session with the mode on is not re-zoomed', async () => {
  const session = setup()
  const view = session.addView('LinearSyntenyView', {
    sameScale: true,
    views: [
      {
        type: 'LinearGenomeView',
        bpPerPx: 4,
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: SMALL_BP, assemblyName: 'small' },
        ],
      },
      {
        type: 'LinearGenomeView',
        bpPerPx: 4,
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: LARGE_BP, assemblyName: 'large' },
        ],
      },
    ],
  }) as LinearSyntenyViewModel

  view.setWidth(800)
  await when(() => view.views.every(v => v.initialized))

  expect(view.sameScale).toBe(true)
  // the saved zoom, not the shared ceiling the mode implies
  expect(view.views[0]!.bpPerPx).toBe(4)
  expect(view.views[0]!.maxBpPerPx).toBeGreaterThan(4)
})

// The mode is a property, so it is restored from the snapshot at attach — where
// the width autorun has nothing to push yet and a row's `fitBpPerPx` throws
// rather than answering. Reaching the getter there took an uncaught MobX
// reaction error with it, on every reload of a saved same-scale session.
test('a restored session with the mode on attaches before any width', async () => {
  const session = setup()
  const errors: unknown[] = []
  const spy = jest
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => {
      errors.push(args[0])
    })
  const view = session.addView('LinearSyntenyView', {
    sameScale: true,
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: SMALL_BP, assemblyName: 'small' },
        ],
      },
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: LARGE_BP, assemblyName: 'large' },
        ],
      },
    ],
  }) as LinearSyntenyViewModel
  spy.mockRestore()

  expect(errors).toEqual([])
  expect(view.sharedFit).toEqual({ answered: false })

  // and once the rows are measured and their assemblies are in, the ceiling
  // arrives on its own — the same reads that were unanswerable at attach
  view.setWidth(800)
  await when(() => view.views.every(v => v.initialized))
  expect(view.sharedFit).toEqual({
    answered: true,
    bpPerPx: view.views[1]!.fitBpPerPx,
  })
  expect(view.views[0]!.maxBpPerPx).toBeCloseTo(view.views[1]!.fitBpPerPx)
})

// The clamp pass belongs to the shared scale, so with the mode off it must not
// run at all — not merely not throw. A saved session is where the difference
// shows: a row restored zoomed out past its own fit is where the user left the
// view, and with no shared ceiling there is nothing to pull it back in for. The
// pass ran anyway, because `answered` is true with the mode off — it answers 0
// without reading a row.
//
// Reproduced end to end in `ExportSvgLinearSyntenyView.test.tsx`, where the
// re-clamp widens ctgA from 499.01 to 527.5 in the exported figure.
test('a restored row zoomed out past its own fit is left where it was saved', async () => {
  const session = setup()
  const view = session.addView('LinearSyntenyView', {
    views: [
      {
        type: 'LinearGenomeView',
        bpPerPx: 500,
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: SMALL_BP, assemblyName: 'small' },
        ],
      },
      {
        type: 'LinearGenomeView',
        bpPerPx: 500,
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: LARGE_BP, assemblyName: 'large' },
        ],
      },
    ],
  }) as LinearSyntenyViewModel

  view.setWidth(800)
  await when(() => view.views.every(v => v.initialized))

  const [small, large] = view.views
  expect(view.sameScale).toBe(false)
  // both saved past their own fit, which is the state a clamp would move
  expect(small!.fitBpPerPx).toBeLessThan(500)
  expect(large!.fitBpPerPx).toBeLessThan(500)

  expect(small!.bpPerPx).toBe(500)
  expect(large!.bpPerPx).toBe(500)
})

// mode off is `answered` without reading a row, so the clamp loop it guards ran
// on every restored stack before any row had a width
test('a restored session with the mode OFF attaches before any width', async () => {
  const session = setup()
  const errors: unknown[] = []
  const spy = jest
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => {
      errors.push(args[0])
    })
  const view = session.addView('LinearSyntenyView', {
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: SMALL_BP, assemblyName: 'small' },
        ],
      },
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: LARGE_BP, assemblyName: 'large' },
        ],
      },
    ],
  }) as LinearSyntenyViewModel

  expect(errors).toEqual([])
  expect(view.sameScale).toBe(false)
  expect(view.sharedFit).toEqual({ answered: true, bpPerPx: 0 })

  // still under the spy: a guard that only deferred the throw would land here
  view.setWidth(800)
  await when(() => view.views.every(v => v.initialized))
  spy.mockRestore()

  expect(errors).toEqual([])
  // mode off raises no ceiling, so each row keeps its own limit
  const [small, large] = view.views
  expect(small!.maxBpPerPx).toBeCloseTo(small!.fitBpPerPx)
  expect(small!.fitBpPerPx).toBeLessThan(large!.fitBpPerPx)
})

// The ceiling tracks the rows, so removing the largest row LOWERS it — and
// nothing else re-clamps a row's zoom. Left alone, the survivor sits ten times
// past its own limit, drawn as a sliver of its pane with zoom-out disabled and
// the slider's min above its value: recoverable only by zooming in first.
test('dropping the largest row brings the survivors down with the ceiling', async () => {
  const view = await launch({ views: [...views, { assembly: 'small' }] })
  const small = view.views[0]!

  view.showAllRegionsAcrossRows(true)
  expect(small.bpPerPx).toBeGreaterThan(small.fitBpPerPx)

  // twice: the appended small row first, then the large row whose fit IS the
  // shared scale
  view.removeLastRow()
  view.removeLastRow()

  expect(small.bpPerPx).toBeCloseTo(small.fitBpPerPx)
  expect(small.bpPerPx).toBeLessThanOrEqual(small.maxBpPerPx)
  expect(small.displayedRegionsTotalPx).toBeCloseTo(800 * 0.9)
  // a ceiling drop moves the window in one step, so it settles like every other
  // jump — `clampZoomToCeiling` is the placer, and only a container can drive it
  // past its own limit, so this is the one harness that can check it
  expect(small.coarseBpPerPx).toBe(small.bpPerPx)
  expect(small.coarseDynamicBlocks.map(b => b.key)).toEqual(
    small.dynamicBlocks.contentBlocks.map(b => b.key),
  )
})

// The two are offered as one choice — "each row fit to width" against "same bp
// per pixel" — so they have to differ in nothing but the scale. Taken off
// whatever a row happened to be displaying, the shared scale came off a region
// SUBSET: narrow the largest row and "same bp per pixel" put the stack on a
// scale that fits nobody's genome, and the choice stopped being reversible.
test('the two show-all-regions modes differ only in scale', async () => {
  const view = await launch({ views })
  const [small, large] = view.views
  // the large row cut down to the small one's size, which is the ordinary
  // state after navigating a row anywhere
  large!.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: SMALL_BP, assemblyName: 'large' },
  ])
  const subsetFit = large!.fitBpPerPx
  expect(subsetFit).toBeLessThan(small!.fitBpPerPx * 2)

  view.showAllRegionsAcrossRows(true)

  // the shared scale is the LARGE ASSEMBLY's fit, not the subset's
  expect(large!.displayedRegions).toHaveLength(2)
  expect(small!.bpPerPx).toBeCloseTo(large!.fitBpPerPx)
  expect(small!.bpPerPx).toBeGreaterThan(subsetFit)

  // ...so the choice is reversible: back and forth lands on the same two
  // scales it left
  const shared = small!.bpPerPx
  view.showAllRegions()
  const ownFit = small!.bpPerPx
  expect(ownFit).not.toBeCloseTo(shared)
  view.showAllRegionsAcrossRows(true)
  expect(small!.bpPerPx).toBeCloseTo(shared)
  view.showAllRegions()
  expect(small!.bpPerPx).toBeCloseTo(ownFit)
})

// `sameScale` is applied after `views[].loc`. Running the menu command there —
// which resets every row to its whole assembly, correctly, because its label
// says "show all regions" — discarded the locations the same spec had just
// asked for.
test('sameScale keeps the rows where views[].loc put them', async () => {
  const view = await launch({
    views: [
      { assembly: 'small', loc: 'ctgB' },
      { assembly: 'large', loc: 'ctgB' },
    ],
    sameScale: true,
  })
  const [small, large] = view.views

  expect(small!.displayedRegions.map(r => r.refName)).toEqual(['ctgB'])
  expect(large!.displayedRegions.map(r => r.refName)).toEqual(['ctgB'])
  // ...and they are still on one scale
  expect(view.sameScale).toBe(true)
  expect(small!.bpPerPx).toBeCloseTo(large!.bpPerPx)
})

// A row is not `initialized` until it has been measured and its assembly has
// landed, so every appended row puts the stack briefly out of reach of an
// answer. Read as "no shared ceiling" that is destructive and one-way: it
// clamps the rows down to their own fits, and restoring the ceiling cannot lift
// them back, since a row already in range is one zoomTo leaves alone. The mode
// stays on and the radio keeps saying "same bp per pixel" over a stack that is
// no longer on one.
test('appending a row that cannot answer yet leaves the stack alone', async () => {
  const view = await launch({ views })
  view.showAllRegionsAcrossRows(true)
  const [small, large] = view.views
  const shared = small!.bpPerPx
  expect(shared).toBeCloseTo(large!.bpPerPx)

  view.appendRow({ assembly: 'not-loaded-yet' })

  expect(view.sharedFit).toEqual({ answered: false })
  expect(small!.bpPerPx).toBeCloseTo(shared)
  expect(large!.bpPerPx).toBeCloseTo(shared)
})
