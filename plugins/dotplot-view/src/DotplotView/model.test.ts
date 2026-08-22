import { getSession } from '@jbrowse/core/util'
import {
  createTestSession,
  createTestSessionAsync,
} from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// self-vs-self layout: both axes show ctgA at bpPerPx=1, offsetPx=0. borderY is
// now derived from the axis labels, so tests read model.viewHeight rather than
// assuming a fixed border.
async function setup({ vviewReversed = false } = {}) {
  const session = (await createTestSessionAsync({
    sessionSnapshot: {
      views: [
        {
          type: 'DotplotView',
          height: 600,
          assemblyNames: ['volvox', 'volvox'],
          hview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
            ],
          },
          vview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              {
                assemblyName: 'volvox',
                refName: 'ctgA',
                start: 0,
                end: 1000,
                reversed: vviewReversed,
              },
            ],
          },
        },
      ],
    },
  })) as any
  return session.views[0]
}

test('getHHighlightCoords maps a region to px on the horizontal axis', async () => {
  const model = await setup()
  expect(
    model.getHHighlightCoords({ refName: 'ctgA', start: 100, end: 200 }),
  ).toEqual({ left: 100, width: 100 })
})

test('getVHighlightCoords flips the band into screen space', async () => {
  const model = await setup()
  // top = viewHeight - (left 100 + width 100)
  expect(
    model.getVHighlightCoords({ refName: 'ctgA', start: 100, end: 200 }),
  ).toEqual({ top: model.viewHeight - 200, height: 100 })
})

test('off-axis region returns undefined', async () => {
  const model = await setup()
  expect(
    model.getHHighlightCoords({ refName: 'ctgZ', start: 100, end: 200 }),
  ).toBeUndefined()
  expect(
    model.getVHighlightCoords({ refName: 'ctgZ', start: 100, end: 200 }),
  ).toBeUndefined()
})

// The two axes of a dotplot are two different assemblies, and the pixel lookup
// under these getters compares refNames only — so a `chr1` shared by the target
// and query assemblies used to band BOTH axes for a highlight belonging to one.
function asmConf(name: string, aliases: string[] = []) {
  return {
    name,
    aliases,
    sequence: {
      trackId: `${name}_refseq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'chr1',
            uniqueId: 'chr1',
            start: 0,
            end: 1000,
            seq: 'a'.repeat(1000),
          },
        ],
      },
    },
  }
}

async function setupTwoAssemblies() {
  const session = createTestSession() as any
  session.addAssemblyConf(asmConf('hg38', ['GRCh38']))
  session.addAssemblyConf(asmConf('mm10'))
  await session.assemblyManager.waitForAssembly('hg38')
  await session.assemblyManager.waitForAssembly('mm10')
  const region = (assemblyName: string) => ({
    assemblyName,
    refName: 'chr1',
    start: 0,
    end: 1000,
  })
  const view = await session.launchView('DotplotView', {
    height: 600,
    assemblyNames: ['hg38', 'mm10'],
    hview: { bpPerPx: 1, offsetPx: 0, displayedRegions: [region('hg38')] },
    vview: { bpPerPx: 1, offsetPx: 0, displayedRegions: [region('mm10')] },
  })
  view.setWidth(800)
  return view
}

test('a highlight naming one axis assembly does not band the other axis', async () => {
  const model = await setupTwoAssemblies()
  const span = { refName: 'chr1', start: 100, end: 200 }

  expect(
    model.getHHighlightCoords({ ...span, assemblyName: 'hg38' }),
  ).toBeDefined()
  expect(
    model.getVHighlightCoords({ ...span, assemblyName: 'hg38' }),
  ).toBeUndefined()

  expect(
    model.getHHighlightCoords({ ...span, assemblyName: 'mm10' }),
  ).toBeUndefined()
  expect(
    model.getVHighlightCoords({ ...span, assemblyName: 'mm10' }),
  ).toBeDefined()
})

test('an alias of the axis assembly still bands that axis', async () => {
  const model = await setupTwoAssemblies()
  const span = { refName: 'chr1', start: 100, end: 200, assemblyName: 'GRCh38' }
  expect(model.getHHighlightCoords(span)).toBeDefined()
  expect(model.getVHighlightCoords(span)).toBeUndefined()
})

// hand-authored session JSON and grid bookmarks may omit it (an init.highlight
// entry never does — coerceHighlight stamps the axis it named, else the h axis)
test('a highlight with no assemblyName bands both axes', async () => {
  const model = await setupTwoAssemblies()
  const span = { refName: 'chr1', start: 100, end: 200 }
  expect(model.getHHighlightCoords(span)).toBeDefined()
  expect(model.getVHighlightCoords(span)).toBeDefined()
})

test('addHighlightFromMouseCoords bands the drag rect on both axes', async () => {
  const model = await setup()
  const { viewHeight } = model
  // drag from (100, viewHeight-200) to (300, viewHeight-400): x-span 100-300 on
  // the h axis, y-span 200-400 on the v axis (which lays out bottom-to-top)
  model.addHighlightFromMouseCoords(
    [100, viewHeight - 200],
    [300, viewHeight - 400],
  )
  expect(model.highlight).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 100, end: 300 },
    { assemblyName: 'volvox', refName: 'ctgA', start: 200, end: 400 },
  ])
})

test('addHighlightFromMouseCoords clamps a drag past the region edges', async () => {
  const model = await setup()
  const { viewHeight } = model
  // ctgA is 0-1000 at bpPerPx=1, so both ends of this drag run off the region
  model.addHighlightFromMouseCoords(
    [-50, viewHeight + 50],
    [1200, viewHeight - 1200],
  )
  expect(model.highlight).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
  ])
})

// auto-diagonalize reverses query regions, so the vertical axis routinely has
// them. bp then decreases with screen position, and taking the drag's ends in
// gesture order emitted start > end — a backwards region that gets persisted.
test('addHighlightFromMouseCoords orders the band on a reversed region', async () => {
  const model = await setup({ vviewReversed: true })
  const { viewHeight } = model
  model.addHighlightFromMouseCoords(
    [100, viewHeight - 200],
    [300, viewHeight - 400],
  )
  for (const h of model.highlight) {
    expect(h.start).toBeLessThan(h.end)
  }
  // the reversed axis maps px 200..400 to bp 600..800 (1000 - px)
  expect(model.highlight[1]).toEqual({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 600,
    end: 800,
  })
})

// Two regions on the h axis, the first reversed — the shape auto-diagonalize
// leaves behind. A drag that runs off the first region and into the second is
// clamped to the edge of the one it started in, and on a reversed region that
// edge is `start`: bp decreases as the drag travels right. Clamping to `end`
// unconditionally banded the complement of what was selected.
async function setupTwoHRegions() {
  const session = (await createTestSessionAsync({
    sessionSnapshot: {
      views: [
        {
          type: 'DotplotView',
          height: 600,
          assemblyNames: ['volvox', 'volvox'],
          hview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              {
                assemblyName: 'volvox',
                refName: 'ctgA',
                start: 0,
                end: 1000,
                reversed: true,
              },
              { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 1000 },
            ],
          },
          vview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
            ],
          },
        },
      ],
    },
  })) as any
  return session.views[0]
}

test('a drag off a reversed region clamps to the edge it was heading for', async () => {
  const model = await setupTwoHRegions()
  const { viewHeight } = model
  // px 800 is bp 200 of the reversed ctgA; px 1500 is inside ctgB
  model.addHighlightFromMouseCoords([800, viewHeight - 100], [1500, 0])
  expect(model.highlight[0]).toEqual({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 200,
  })
})

// Wheel zoom anchors on a plot-area point in the same top-down component px the
// drag handlers use, and the flip into the bottom-up vertical axis is the
// model's — the handler used to do it against a separately measured element
// height, which is the grid cell (it grows when an error banner appears), not
// the plot.
test('zoomAt zooms both axes and holds the locus under the anchor', async () => {
  const model = await setup()
  const { viewHeight } = model
  const anchor: [number, number] = [200, viewHeight - 300]
  const before = {
    x: model.hview.pxToBp(anchor[0]).coord0,
    y: model.vview.pxToBp(viewHeight - anchor[1]).coord0,
  }

  model.zoomAt(0.5, anchor)

  // one factor for both axes, which is what keeps wheel zoom ratio-preserving
  expect(model.hview.bpPerPx).toBe(0.5)
  expect(model.vview.bpPerPx).toBe(0.5)
  // offsetPx rounds to whole px, so the anchored locus can drift by under a px
  expect(model.hview.pxToBp(anchor[0]).coord0).toBeCloseTo(before.x, 0)
  expect(model.vview.pxToBp(viewHeight - anchor[1]).coord0).toBeCloseTo(
    before.y,
    0,
  )
})

// Turning the lock on squares the axes through the autorun alone — the menu
// checkbox used to call squareView() as well, which re-ran applySquare over
// already-equal axes and re-centered them through centerAt's offsetPx rounding.
test('locking the aspect ratio squares the axes on its own', async () => {
  const model = await setup()
  model.setWidth(800)
  model.hview.setBpPerPx(2)
  expect(model.hview.bpPerPx).not.toBe(model.vview.bpPerPx)

  model.setLockAspectRatio(true)
  expect(model.hview.bpPerPx).toBe(model.vview.bpPerPx)

  // and it keeps them squared as one axis is zoomed independently
  model.vview.setBpPerPx(4)
  expect(model.hview.bpPerPx).toBe(model.vview.bpPerPx)
})

// A locked plot runs both axes at ONE bpPerPx, and it has to be the larger of
// the two fits for the longer genome to fit at all — which is legitimately past
// the shorter axis' own. Clamping each axis to its own instead pulled the
// shorter one back in while the longer one held, and the lock autorun then
// squared the pair to the average of the two.
async function setupUnequalAxes() {
  const session = (await createTestSessionAsync({
    sessionSnapshot: {
      views: [
        {
          type: 'DotplotView',
          height: 600,
          assemblyNames: ['volvox', 'volvox'],
          hview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              {
                assemblyName: 'volvox',
                refName: 'ctgA',
                start: 0,
                end: 100000,
              },
            ],
          },
          vview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              {
                assemblyName: 'volvox',
                refName: 'ctgA',
                start: 0,
                end: 400000,
              },
            ],
          },
        },
      ],
    },
  })) as any
  const view = session.views[0]
  view.setWidth(800)
  view.setLockAspectRatio(true)
  view.showAllRegions()
  return view
}

test('zooming out on a locked plot at full extent does nothing', async () => {
  const model = await setupUnequalAxes()
  const full = model.hview.bpPerPx
  // the shared fit is the longer genome's, past the h axis' own
  expect(full).toBe(model.vview.fitBpPerPx)
  expect(full).toBeGreaterThan(model.hview.fitBpPerPx)

  model.zoomOut()

  // it used to clamp the h axis to its own fit and land the pair on the average
  // of the two — so a click meaning "show me more" showed less
  expect(model.hview.bpPerPx).toBe(full)
  expect(model.vview.bpPerPx).toBe(full)
})

test('a locked plot zooms back out to the full extent it started at', async () => {
  const model = await setupUnequalAxes()
  const full = model.hview.bpPerPx
  for (let i = 0; i < 3; i++) {
    model.zoomIn()
  }
  expect(model.hview.bpPerPx).toBeLessThan(full)
  for (let i = 0; i < 8; i++) {
    model.zoomOut()
  }
  // showAllRegions was the only way back: the pair converged on the average of
  // the two fits and no number of clicks moved it
  expect(model.hview.bpPerPx).toBe(full)
  expect(model.vview.bpPerPx).toBe(full)
})

test('an unlocked plot still stops each axis at its own fit', async () => {
  const model = await setupUnequalAxes()
  model.setLockAspectRatio(false)
  for (let i = 0; i < 8; i++) {
    model.zoomOut()
  }
  expect(model.hview.bpPerPx).toBe(model.hview.fitBpPerPx)
  expect(model.vview.bpPerPx).toBe(model.vview.fitBpPerPx)
})

test('a drag under the 3px threshold adds no highlight', async () => {
  const model = await setup()
  model.addHighlightFromMouseCoords([100, 100], [102, 102])
  expect(model.highlight).toHaveLength(0)
})

test('settled gates on autoDiagonalize completion when requested', async () => {
  const model = await setup()
  model.markCanvasDrawn()
  // nothing requested: settled once the canvas is drawn (no displays loading)
  expect(model.settled).toBe(true)

  // an init-time reorder is requested: the plot is NOT done until it completes,
  // so a screenshot/browser-test can't capture the pre-diagonalize plot
  model.beginAutoDiagonalize(true)
  expect(model.settled).toBe(false)

  // reorder resolved successfully: settled is released
  model.finishAutoDiagonalize()
  expect(model.settled).toBe(true)
})

// Each init apply re-declares the gate. Without that, a superseded init that
// requested a reorder and then skipped it leaves it raised with nothing coming,
// and `settled` never fires again — a capture hangs instead of failing.
test('a following init re-declares the autoDiagonalize gate', async () => {
  const model = await setup()
  model.markCanvasDrawn()

  model.beginAutoDiagonalize(true)
  expect(model.settled).toBe(false)

  // superseded by an init that wants no reorder: the request is withdrawn
  model.beginAutoDiagonalize(false)
  expect(model.settled).toBe(true)

  // and a completed pass can't satisfy the gate for the next requesting init,
  // which would let a capture commit the new, un-reordered plot
  model.finishAutoDiagonalize()
  model.beginAutoDiagonalize(true)
  expect(model.settled).toBe(false)
})

// An init that hasn't been applied yet means the tracks it names don't exist,
// and a plot with no displays settles vacuously — so the gate has to hold on
// `init` itself, not just on what the displays report.
test('settled gates on an unapplied init', async () => {
  const model = await setup()
  model.markCanvasDrawn()
  expect(model.settled).toBe(true)

  // no width in this fixture, so the init autorun never fires and this stays
  // pending — the same state the real apply passes through
  model.setInit({ views: [{ assembly: 'volvox' }, { assembly: 'volvox' }] })
  expect(model.settled).toBe(false)
})

// One assemblyName leaves the vertical axis with no regions —
// initializeDisplayedRegions walks the two axes in step with the array — so
// `initialized` never comes true and the view used to sit on "Loading" forever
// with the assembly it was waiting for already loaded
test('a snapshot naming one assembly says so instead of spinning', async () => {
  const session = (await createTestSessionAsync({
    sessionSnapshot: {
      views: [{ type: 'DotplotView', height: 600, assemblyNames: ['volvox'] }],
    },
  })) as any
  const model = session.views[0]
  expect(`${model.error}`).toContain('exactly two assemblyNames')
  // an error is the import form with a banner, never the loading screen
  expect(model.showImportForm).toBe(true)
  expect(model.showLoading).toBe(false)
})

test('two assemblyNames is not an error, and neither is none', async () => {
  expect((await setup()).error).toBeFalsy()
  const session = (await createTestSessionAsync({
    sessionSnapshot: { views: [{ type: 'DotplotView' }] },
  })) as any
  // no names at all is the import form, not a malformed view
  expect(session.views[0].error).toBeFalsy()
})

// "Return to import form" is the one route to the form that isn't a submit, so
// it was the one that left the previous submit's banner standing over a form
// with nothing wrong with it.
test('returning to the import form drops the banner with the view', async () => {
  const model = await setup()
  model.setError(new Error('could not resolve track'))
  expect(model.showImportForm).toBe(true)

  model.clearView()

  expect(model.error).toBeFalsy()
  expect(model.showImportForm).toBe(true)
  expect(model.assemblyNames).toHaveLength(0)
})

test('highlight actions add/remove and toggle visibility', async () => {
  const model = await setup()
  const h = { refName: 'ctgA', start: 0, end: 10, assemblyName: 'volvox' }
  model.addToHighlights(h)
  expect(model.highlight.length).toBe(1)
  const session = getSession(model)
  expect(session.highlightsVisible).toBe(true)
  session.setHighlightsVisible(false)
  expect(session.highlightsVisible).toBe(false)
  model.removeHighlight(model.highlight[0])
  expect(model.highlight.length).toBe(0)
})
