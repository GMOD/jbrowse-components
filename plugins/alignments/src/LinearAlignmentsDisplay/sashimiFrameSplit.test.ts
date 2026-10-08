import { autorun } from 'mobx'

import { encodeDinucleotide } from '../features/sashimi/motif.ts'
import {
  createTestAlignmentsDisplay,
  makeEmptyPileupData,
} from './testUtils.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'
import type { LinearAlignmentsDisplayModel } from './components/useAlignmentsBase.ts'

// A pan neither re-merges the sashimi junctions nor rebuilds the feed their
// marks draw from, and this file counts both rather than asserting the shape
// that is supposed to produce them.
//
// HOW THE COUNT WORKS. An OBSERVED MobX computed hands back its cached value
// until something it read changes, and every evaluation of these builds a
// fresh value. So the number of distinct identities seen across a gesture IS the
// number of evaluations, exactly — no spy, no mock, no instrumentation in the
// code under test. The `autorun` is what makes them observed; unobserved, MST
// getters recompute on every read and the count would be the number of reads.
//
// THE SABOTAGE THIS CATCHES is the shape the code had: reading
// `view.visibleRegions` (a fresh array of fresh objects per frame) inside the
// merge. That takes the junction count to one per frame and fails the first
// expectation. Dropping `compareStructural` off the model's `junctionRegions`
// computed does the same, which is the narrower sabotage: the getter still
// exists and still looks split.

const FRAMES = 20

// Two junctions inside the span the pan keeps on screen, so the label count
// never changes for a reason other than the projection.
function seedJunctions(display: LinearAlignmentsDisplayModel) {
  const data: WorkerPileupData = {
    ...makeEmptyPileupData(),
    sashimiX1: new Uint32Array([1000, 3000]),
    sashimiX2: new Uint32Array([2000, 5000]),
    sashimiFwd: new Uint32Array([40, 0]),
    sashimiRev: new Uint32Array([0, 12]),
    sashimiDonors: new Uint8Array([encodeDinucleotide('GT'), 0]),
    sashimiAcceptors: new Uint8Array([encodeDinucleotide('AG'), 0]),
    sashimiCounts: new Uint32Array([40, 12]),
  }
  display.setRpcData(
    0,
    { groups: [{ key: '', label: '', data }] },
    display.view.displayedRegions[0]!,
  )
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

test('a pan re-merges nothing and rebuilds no feed', () => {
  const { view, display } = panningDisplay()
  seedJunctions(display)

  const merges = identityCounter<unknown>()
  const feeds = identityCounter<unknown>()
  const labels = identityCounter<unknown>()
  const stop = autorun(() => {
    merges.note(display.sashimiJunctionSections)
    feeds.note(display.sashimiFeedsByGroup)
    labels.note(display.sashimiLabels)
  })

  for (let i = 1; i <= FRAMES; i++) {
    view.setNewView(10, i * 7)
    merges.note(display.sashimiJunctionSections)
    feeds.note(display.sashimiFeedsByGroup)
    labels.note(display.sashimiLabels)
  }
  stop()

  // The whole point: one merge and one feed for the gesture. The arcs are
  // placed through the view's region table, a uniform, so a fresh feed would be
  // a re-upload per pan frame. With the count labels off nothing reads the pan.
  expect(merges.count).toBe(1)
  expect(feeds.count).toBe(1)
  expect(labels.count).toBe(1)

  // …and the feed is carrying something, so the expectations above cannot
  // pass by the pipeline being empty or the pan being a no-op.
  expect(display.sashimiFeedsByGroup.get('')!.get(0)!.up.count).toBe(2)
  expect(display.sashimiJunctionSections[0]!.junctions).toHaveLength(2)
})

// The count labels are the one part still in the DOM, so they are the one part
// a pan re-projects, and only while they are shown.
test('with count labels on, a pan re-projects the labels alone', () => {
  const { view, display } = panningDisplay()
  display.setShowSashimiLabels(true)
  seedJunctions(display)

  const feeds = identityCounter<unknown>()
  const labels = identityCounter<unknown>()
  const stop = autorun(() => {
    feeds.note(display.sashimiFeedsByGroup)
    labels.note(display.sashimiLabels)
  })
  for (let i = 1; i <= FRAMES; i++) {
    view.setNewView(10, i * 7)
    feeds.note(display.sashimiFeedsByGroup)
    labels.note(display.sashimiLabels)
  }
  stop()

  expect(feeds.count).toBe(1)
  expect(labels.count).toBe(FRAMES + 1)
  expect(display.sashimiLabels).toHaveLength(2)
})

// The DNA case, which is most alignments tracks: `showSashimiArcs` resolves on
// wherever coverage draws, so every one of them evaluates this pipeline, and a
// track whose reads carry no skip gap has nothing for it to draw. One shared
// empty array is what lets `SashimiLabelsOverlay`'s observer stop on `===`
// instead of reconciling a list of empty sections per frame.
test('a track with no junctions hands the overlay the same empty array', () => {
  const { view, display } = panningDisplay()
  display.setShowSashimiLabels(true)
  display.setRpcData(
    0,
    {
      groups: [{ key: '', label: '', data: makeEmptyPileupData() }],
    },
    display.view.displayedRegions[0]!,
  )

  const projections = identityCounter<unknown>()
  const states = identityCounter<unknown>()
  const stop = autorun(() => {
    projections.note(display.sashimiLabels)
    states.note(display.renderState)
  })
  for (let i = 1; i <= FRAMES; i++) {
    view.setNewView(10, i * 7)
    projections.note(display.sashimiLabels)
    states.note(display.renderState)
  }
  stop()

  expect(projections.count).toBe(1)
  // The marks place their feet through the view's region table, which reads
  // the pan. A track with no junction asks for no table, so the pan leaves its
  // render state the same object: gating the table on the SETTING, which is on
  // by default, rebuilt it on every frame of every alignments track.
  expect(states.count).toBe(1)
  expect(display.sashimiLabels).toHaveLength(0)
})

// The band's feeds are placed through the view's region table, a uniform, so
// a pan must not rebuild them: a fresh feed is a re-upload of every band
// buffer, once per pan frame.
test('read connections on: a pan leaves the band feeds the same object', () => {
  const { view, display } = panningDisplay()
  display.setReadConnections('arc')
  seedJunctions(display)

  const feeds = identityCounter<unknown>()
  const stop = autorun(() => {
    feeds.note(display.arcFeedsByGroup)
  })
  for (let i = 1; i <= FRAMES; i++) {
    view.setNewView(10, i * 7)
    feeds.note(display.arcFeedsByGroup)
  }
  stop()

  expect(feeds.count).toBe(1)
})

// The key reads the merged junctions' strands, not the projected arcs, so a pan
// leaves it the same object; one rebuilt per frame re-lays the legend per frame.
test('a pan leaves the legend the same object', () => {
  const { view, display } = panningDisplay()
  display.setShowLegend(true)
  seedJunctions(display)

  const scales = identityCounter<unknown>()
  const stop = autorun(() => {
    scales.note(display.colorScales)
  })
  for (let i = 1; i <= FRAMES; i++) {
    view.setNewView(10, i * 7)
    scales.note(display.colorScales)
  }
  stop()

  expect(scales.count).toBe(1)
  expect(display.sashimiLegendStrands).toEqual(new Set([1, -1]))
})
