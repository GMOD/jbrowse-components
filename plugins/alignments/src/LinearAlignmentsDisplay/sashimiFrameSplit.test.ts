import { autorun } from 'mobx'

import {
  createTestAlignmentsDisplay,
  makeEmptyPileupData,
} from './testUtils.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'
import type { LinearAlignmentsDisplayModel } from './components/useAlignmentsBase.ts'

// A pan re-projects sashimi arcs and does NOT re-merge their junctions, and this
// file counts both halves rather than asserting the shape that is supposed to
// produce them.
//
// HOW THE COUNT WORKS. An OBSERVED MobX computed hands back its cached value
// until something it read changes, and every evaluation of these two builds a
// fresh array. So the number of distinct identities seen across a gesture IS the
// number of evaluations, exactly — no spy, no mock, no instrumentation in the
// code under test. The `autorun` is what makes them observed; unobserved, MST
// getters recompute on every read and the count would be the number of reads.
//
// THE SABOTAGE THIS CATCHES is the shape the code had: reading
// `view.visibleRegions` (a fresh array of fresh objects per frame) inside the
// merge, whether directly or by folding the merge back into
// `sashimiArcSections`. Either takes the junction count to one per frame and
// fails the first expectation. Dropping `compareStructural` off the model's
// `junctionRegions` computed does the same, which is the narrower sabotage: the
// getter still exists and still looks split.

const FRAMES = 20

// Two junctions inside the span the pan keeps on screen, so the arc count never
// changes for a reason other than the projection — the off-screen cull dropping
// one mid-gesture would make the second expectation mean something else.
function seedJunctions(display: LinearAlignmentsDisplayModel) {
  const data: WorkerPileupData = {
    ...makeEmptyPileupData(),
    sashimiX1: new Uint32Array([1000, 3000]),
    sashimiX2: new Uint32Array([2000, 5000]),
    sashimiStrands: new Int8Array([1, -1]),
    sashimiMotifs: new Uint8Array([1, 1]),
    sashimiCounts: new Uint32Array([40, 12]),
  }
  display.setRpcData(0, { groups: [{ key: '', label: '', data }] })
}

// Distinct values a computed produced, in order — see the file header.
function identityCounter<T>() {
  const seen: T[] = []
  return {
    note(value: T) {
      if (seen.at(-1) !== value) {
        seen.push(value)
      }
    },
    get count() {
      return seen.length
    },
  }
}

function panningDisplay() {
  const { view, display } = createTestAlignmentsDisplay()
  view.setNewView(10, 0)
  display.setShowSashimiArcs(true)
  display.setShowCoverage(true)
  return { view, display }
}

test('a pan re-projects the arcs and re-merges nothing', () => {
  const { view, display } = panningDisplay()
  seedJunctions(display)

  const merges = identityCounter<unknown>()
  const projections = identityCounter<unknown>()
  const stop = autorun(() => {
    merges.note(display.sashimiJunctionSections)
    projections.note(display.sashimiArcSections)
  })

  for (let i = 1; i <= FRAMES; i++) {
    view.setNewView(10, i * 7)
    merges.note(display.sashimiJunctionSections)
    projections.note(display.sashimiArcSections)
  }
  stop()

  // The whole point: one merge for the gesture, one projection per frame.
  expect(merges.count).toBe(1)
  expect(projections.count).toBe(FRAMES + 1)

  // …and the projection is doing something, so the first expectation cannot
  // pass by the pipeline being empty or the pan being a no-op.
  const [section] = display.sashimiArcSections
  expect(section!.up.length).toBe(2)
  expect(display.sashimiJunctionSections[0]!.junctions).toHaveLength(2)
})

// The DNA case, which is most alignments tracks: `showSashimiArcs` resolves on
// wherever coverage draws, so every one of them evaluates this pipeline, and a
// track whose reads carry no skip gap has nothing for it to project. One shared
// empty array is what lets `SashimiArcsOverlay`'s observer stop on `===` instead
// of reconciling a list of empty sections per frame.
test('a track with no junctions hands the overlay the same empty array', () => {
  const { view, display } = panningDisplay()
  display.setRpcData(0, {
    groups: [{ key: '', label: '', data: makeEmptyPileupData() }],
  })

  const projections = identityCounter<unknown>()
  const stop = autorun(() => {
    projections.note(display.sashimiArcSections)
  })
  for (let i = 1; i <= FRAMES; i++) {
    view.setNewView(10, i * 7)
    projections.note(display.sashimiArcSections)
  }
  stop()

  expect(projections.count).toBe(1)
  expect(display.sashimiArcSections).toHaveLength(0)
})

// The same rebuilt-`[]` defect one overlay over, found by the sweep this change
// prompted. `crossRegionArcSections` re-projects every foot through
// `view.bpToPx`, so it re-runs per frame by design — but a SINGLE-REGION view,
// which is nearly every view, resolves no cross-region arc at all, and the
// empty list it handed back was a fresh one each time.
test('read connections on, one region: the empty arc list is the same array', () => {
  const { view, display } = panningDisplay()
  display.setReadConnections('arc')
  seedJunctions(display)

  const projections = identityCounter<unknown>()
  const stop = autorun(() => {
    projections.note(display.crossRegionArcSections)
  })
  for (let i = 1; i <= FRAMES; i++) {
    view.setNewView(10, i * 7)
    projections.note(display.crossRegionArcSections)
  }
  stop()

  expect(projections.count).toBe(1)
  expect(display.crossRegionArcSections).toHaveLength(0)
})
