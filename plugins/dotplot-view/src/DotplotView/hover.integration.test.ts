import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import { buildLineSegments } from '../DotplotDisplay/dotplotGeometry.ts'
import { fakeDotplotRpcData } from '../DotplotDisplay/testUtils.ts'

import type { DotplotDisplayModel } from '../DotplotDisplay/stateModelFactory.tsx'
import type { DotplotRpcData } from '../DotplotDisplay/types.ts'
import type { DotplotViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// One feature per track, committed directly rather than fetched — the same way
// the SVG export tests set up a display holding data. What is under test is the
// pick and the hover state the view derives from it, not the fetch.
function fakeRpcData(h: [number, number], v: [number, number]): DotplotRpcData {
  return fakeDotplotRpcData({
    p11: new Float64Array([h[0]]),
    p12: new Float64Array([h[1]]),
    p21: new Float64Array([v[0]]),
    p22: new Float64Array([v[1]]),
    alignmentLengths: new Uint32Array([h[1] - h[0]]),
    attributes: {},
    refNameDict: ['ctgA'],
    mateRefNameDict: ['ctgA'],
  })
}

function commit(
  display: DotplotDisplayModel,
  view: DotplotViewModel,
  h: [number, number],
  v: [number, number],
) {
  const rpcData = fakeRpcData(h, v)
  display.setRpcData(rpcData, `fake-${display.displayKey}`, [])
  display.setInstanceData(
    buildLineSegments(
      rpcData,
      false,
      0,
      0,
      view.hview.bpPerPx,
      view.vview.bpPerPx,
      0,
      0,
    ),
  )
}

// cumBp -> the plot pixel it is drawn at, by the transform the renderers and the
// pick engine share. Spelled out here because it is the contract under test.
function plotPx(view: DotplotViewModel, hBp: number, vBp: number) {
  const { hview, vview } = view
  return {
    x: hBp / hview.bpPerPx - hview.offsetPx,
    y: view.viewHeight - (vBp / vview.bpPerPx - vview.offsetPx),
  }
}

// Pick at the pixel a genomic (h, v) position is drawn at.
function pickAtBp(view: DotplotViewModel, hBp: number, vBp: number) {
  const { x, y } = plotPx(view, hBp, vBp)
  return view.pickFeatureAt(x, y)
}

async function setup() {
  const session = createTestSession() as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
        ],
      },
    },
  })
  const view = (await session.launchView('DotplotView', {
    init: { views: [{ assembly: 'volvox' }, { assembly: 'volvox' }] },
  })) as DotplotViewModel
  view.setWidth(800)
  await session.assemblyManager.waitForAssembly('volvox')
  await when(() => view.initialized)

  for (const trackId of ['trackA', 'trackB']) {
    session.addSessionTrackConf({
      trackId,
      name: trackId,
      type: 'SyntenyTrack',
      assemblyNames: ['volvox', 'volvox'],
      adapter: {
        type: 'PAFAdapter',
        pafLocation: { uri: `${trackId}.paf`, locationType: 'UriLocation' },
        assemblyNames: ['volvox', 'volvox'],
      },
    })
    await view.launchTrack(trackId)
  }
  await when(() => view.dotplotDisplays.every(d => d.ready))
  const [a, b] = view.dotplotDisplays
  // A is on the diagonal at 1000..2000; B is somewhere else entirely, so a hit
  // on one is a miss on the other.
  commit(a!, view, [1000, 2000], [1000, 2000])
  commit(b!, view, [9000, 10000], [3000, 4000])
  return { view, a: a!, b: b! }
}

test('picks the alignment under the pointer, on the track that owns it', async () => {
  const { view, a, b } = await setup()

  expect(pickAtBp(view, 1500, 1500)).toEqual({
    displayKey: a.displayKey,
    featureIdx: 0,
    // the feature's only segment, since no CIGAR detail is drawn here
    segmentIdx: 0,
    distancePx: expect.any(Number),
  })
  expect(pickAtBp(view, 9500, 3500)?.displayKey).toBe(b.displayKey)
  // between the two, on neither
  expect(pickAtBp(view, 5000, 8000)).toBeUndefined()
}, 20000)

test('the hover lands on one track and clears the others', async () => {
  const { view, a, b } = await setup()

  view.setHoveredFeature(pickAtBp(view, 1500, 1500))
  expect(a.hoveredFeatureIdx).toBe(0)
  expect(b.hoveredFeatureIdx).toBe(-1)

  // a miss clears the plot
  view.setHoveredFeature(undefined)
  expect(a.hoveredFeatureIdx).toBe(-1)
  expect(view.hoveredTooltipLines).toBeUndefined()
  expect(view.hoveredHighlight).toBeUndefined()
}, 20000)

test('the view resolves the tooltip and the highlight off the hovered track', async () => {
  const { view, a } = await setup()
  view.setHoveredFeature(pickAtBp(view, 1500, 1500))

  expect(view.hoveredTooltipLines).toEqual(a.tooltipLines)
  expect(view.hoveredTooltipLines?.[0]).toBe('x: {volvox}ctgA:1,001..2,000')

  const highlight = view.hoveredHighlight
  // one segment (no CIGAR detail), drawn between the feature's two corners
  const start = plotPx(view, 1000, 1000)
  const end = plotPx(view, 2000, 2000)
  expect(highlight?.path).toBe(
    `M${round(start.x)} ${round(start.y)}L${round(end.x)} ${round(end.y)}`,
  )
  expect(highlight?.color).toMatch(/^rgba\(/)
}, 20000)

// The plot moving under a stationary cursor is its own invalidation axis, and
// the one nothing re-picks after: the canvas has no element travelling with its
// alignments, so it fires no pointer event when they slide. Asserted on the
// model rather than through a handler because that is where the answer lives —
// one reaction over `plotTransform`, covering every way the plot can move.
//
// A pan is the case that needs it. A zoom is covered twice over, since it also
// rebuilds the geometry the stored index addresses (below).
test('a pan drops the hover, and the tooltip and highlight with it', async () => {
  const { view, a } = await setup()
  view.setHoveredFeature(pickAtBp(view, 1500, 1500))
  expect(a.hoveredSegmentIdx).toBe(0)

  view.scrollXY(50, 0)
  expect(a.hoveredSegmentIdx).toBe(-1)
  expect(view.hoveredTooltipLines).toBeUndefined()
  expect(view.hoveredHighlight).toBeUndefined()
}, 20000)

// A resize is a pan of the v axis: it lays out bottom-up, so every alignment
// slides down the canvas by the height delta while the cursor stays put. It
// reaches the reaction because `viewHeight` is one of `plotTransform`'s numbers
// — left out, this was the one way to move the plot that kept the hover.
test('a height change drops the hover too', async () => {
  const { view, a } = await setup()
  view.setHoveredFeature(pickAtBp(view, 1500, 1500))
  expect(a.hoveredSegmentIdx).toBe(0)

  view.setHeight(view.height + 100)
  expect(a.hoveredSegmentIdx).toBe(-1)
}, 20000)

// The stored index addresses the geometry, so it cannot outlive it — a surviving
// one points at an unrelated alignment. Both writers of that geometry drop it,
// and the second is the one that would be missed: a zoom rebuilds the segments
// without a refetch.
test.each([
  [
    'a refetch',
    (a: DotplotDisplayModel) => {
      a.setRpcData(fakeRpcData([5000, 6000], [5000, 6000]), 'next', [])
    },
  ],
  [
    'a geometry rebuild',
    (a: DotplotDisplayModel) => {
      a.setInstanceData(undefined)
    },
  ],
])(
  '%s drops the hover',
  async (_name, invalidate) => {
    const { view, a } = await setup()
    view.setHoveredFeature(pickAtBp(view, 1500, 1500))
    expect(a.hoveredSegmentIdx).toBe(0)
    expect(a.hoveredFeatureIdx).toBe(0)

    invalidate(a)
    expect(a.hoveredSegmentIdx).toBe(-1)
    expect(a.hoveredFeatureIdx).toBe(-1)
  },
  20000,
)

function round(n: number) {
  return Math.round(n * 10) / 10
}
