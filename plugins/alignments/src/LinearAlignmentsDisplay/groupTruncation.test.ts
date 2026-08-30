import { namesToBlock } from '../shared/readNameBlock.ts'
import { laneExpandable } from './lanes.ts'
import {
  bootAlignmentsDisplay,
  makeEmptyAlignmentsResult,
  makeEmptyPileupData,
} from './testUtils.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'

// Boots a real LinearAlignmentsDisplay, because which cap clipped a lane is a
// property of the whole layout chain (`groupOrder` → `layoutGroupsToViewport` →
// `sections`), and the point of these tests is that the model's two truncation
// answers agree with what that chain actually laid out.
function createEnv() {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay()
  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    getCanonicalRefName2: (refName: string) => refName,
  }
  const Session = baseSession.volatile(() => ({
    rpcManager: {
      call: jest.fn(() => Promise.resolve(makeEmptyAlignmentsResult())),
    },
    assemblyManager: {
      get: (name: string) => (name === 'volvox' ? asm : undefined),
      isValidRefName: () => true,
    },
  }))
  const { view, display } = mount(Session)
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  return display
}

// n reads all covering one span, so the layout has to stack them n rows deep and
// any row cap below n truncates.
function stackedReads(n: number): WorkerPileupData {
  const readPositions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    readPositions[i * 2] = 1000
    readPositions[i * 2 + 1] = 1100
  }
  return {
    ...makeEmptyPileupData(),
    readKeys: Array.from({ length: n }, (_, i) => `r${i}`),
    ...namesToBlock(Array.from({ length: n }, (_, i) => `read${i}`)),
    readPositions,
    readFlags: new Uint16Array(n),
    readMapqs: new Uint8Array(n),
    readStrands: new Int8Array(n).fill(1),
    readInsertSizes: new Float32Array(n),
    readPairOrientations: new Uint8Array(n),
    // One segment per read, spanning it. The collapsed layout tints DEPTH, and
    // it measures depth off the segments (a spliced read must not tint its own
    // intron), so a fixture with no segments collapses to a lane with no overlap
    // at all.
    segmentPositions: readPositions,
    segmentReadIndices: Uint32Array.from({ length: n }, (_, i) => i),
    segmentEdgeFlags: new Uint8Array(n).fill(3),
    numSegments: n,
  }
}

// `groupBy` is set BEFORE the data, because it is a tier-1 setting: setting it
// afterwards re-partitions the fetch and clears what was just seeded.
function seed(
  groups: { key: string; label: string; n: number }[],
  opts: { grouped?: boolean; collapseRows?: boolean } = {},
) {
  const display = createEnv()
  if (opts.grouped || opts.collapseRows) {
    display.setGroupBy({ type: 'strand' })
  }
  if (opts.collapseRows) {
    display.setCollapseGroupRows(true)
  }
  display.setRpcData(0, {
    groups: groups.map(g => ({
      key: g.key,
      label: g.label,
      data: stackedReads(g.n),
    })),
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  })
  return display
}

const rowsIn = (display: ReturnType<typeof seed>, i: number) =>
  display.sections.sections[i]!.maxY
const clippedBy = (display: ReturnType<typeof seed>, key: string) =>
  display.laneFor(key)?.clippedBy
const expandable = (display: ReturnType<typeof seed>, key: string) =>
  laneExpandable(display.laneFor(key))
const ceilingClipped = (display: ReturnType<typeof seed>, key: string) =>
  display.laneFor(key)?.ceilingClipped ?? false
const anyCeilingClipped = (display: ReturnType<typeof seed>) =>
  display.lanes.some(l => l.ceilingClipped)

// A grouping can yield one section (one strand represented, a tag with a single
// value). That section is labelled and collapsible, but it lays out against the
// display-wide `maxHeight` cap, exactly as an ungrouped pileup does — there is
// no viewport split to expand out of. The chip's expand button banked an
// override of that same `maxHeight`, so it showed no extra read while silencing
// both truncation signals.
test('a lone section clipped at maxHeight offers the banner, not the chip', () => {
  const display = seed([{ key: '1', label: 'HP: 1', n: 40 }])
  display.setMaxHeight(40)

  expect(display.showsGroupLabels).toBe(true)
  expect(display.isGrouped).toBe(false)
  expect(clippedBy(display, '1')).toBe('ceiling')
  expect(expandable(display, '1')).toBe(false)
  expect(anyCeilingClipped(display)).toBe(true)
})

// The banner's own action, which is the one that helps here.
test('raising maxHeight lays out the rows the ceiling was hiding', () => {
  const display = seed([{ key: '1', label: 'HP: 1', n: 40 }])
  display.setMaxHeight(40)
  const clipped = rowsIn(display, 0)

  display.setMaxHeight(6000)
  expect(rowsIn(display, 0)).toBeGreaterThan(clipped)
  expect(anyCeilingClipped(display)).toBe(false)
})

// Stacked lanes share the viewport, so their cap is a slice of it and expanding
// one really does raise it — this is the case the chip is for.
test('a lane clipped by its viewport slice offers the chip', () => {
  const display = seed([
    { key: '1', label: 'HP: 1', n: 40 },
    { key: '2', label: 'HP: 2', n: 40 },
  ])
  display.setMaxHeight(400)
  expect(display.isGrouped).toBe(true)
  expect(clippedBy(display, '1')).toBe('budget')

  const clipped = rowsIn(display, 0)
  display.toggleGroupExpanded('1')
  expect(rowsIn(display, 0)).toBeGreaterThan(clipped)
  // and the affordance flips to "fit to view" rather than lingering
  expect(expandable(display, '1')).toBe(false)
  expect(display.groupHeightOverrides.has('1')).toBe(true)
})

// A stacked lane can still hit the display-wide ceiling, where expanding it is
// the same no-op. The banner has to speak for that case too — it used to be
// gated on there being at most one group, so nothing surfaced it at all.
test('a stacked lane clipped at maxHeight raises the banner', () => {
  const display = seed([
    { key: '1', label: 'HP: 1', n: 400 },
    { key: '2', label: 'HP: 2', n: 400 },
  ])
  display.setMaxHeight(40)
  expect(display.isGrouped).toBe(true)
  expect(clippedBy(display, '1')).toBe('ceiling')
  expect(expandable(display, '1')).toBe(false)
  expect(anyCeilingClipped(display)).toBe(true)
})

// Nothing is drawn for the ceiling to clip on a coverage-only stack, so the
// banner offering to raise it is noise.
test('the truncation banner steps aside with the pileup hidden', () => {
  const display = seed([{ key: '1', label: 'HP: 1', n: 40 }])
  display.setMaxHeight(40)
  expect(anyCeilingClipped(display)).toBe(true)

  display.setShowPileup(false)
  expect(anyCeilingClipped(display)).toBe(false)
})

// Both height affordances write `groupMaxHeightOverrides`, so they are offered
// together: fit mode derives the read height to fill the display, which an
// override contradicts.
test('the per-group height affordances are gated together', () => {
  const display = seed([
    { key: '1', label: 'HP: 1', n: 40 },
    { key: '2', label: 'HP: 2', n: 40 },
  ])
  expect(display.canSizeGroupHeights).toBe(true)

  display.setHeightMode('fit')
  expect(display.canSizeGroupHeights).toBe(false)

  display.setHeightMode('fixed')
  display.setShowPileup(false)
  expect(display.canSizeGroupHeights).toBe(false)
})

// A collapsed-to-one-row lane hides depth, and the chip expands it into a true
// stack — so it is a cap like the other three, and it says which one it is. The
// row-count reconstruction this replaced could only infer `'budget'` from the
// arithmetic (one row is below the ceiling), and would have said `'ceiling'`
// instead on a display whose ceiling was itself one row.
test('a lane collapsed to one row names the collapse as its cap', () => {
  const display = seed(
    [
      { key: '1', label: 'HP: 1', n: 40 },
      { key: '2', label: 'HP: 2', n: 40 },
    ],
    { collapseRows: true },
  )

  expect(display.collapseGroupRows).toBe(true)
  expect(rowsIn(display, 0)).toBe(1)
  expect(clippedBy(display, '1')).toBe('collapse')
  // The chip's expand, because banking an override opts the lane out of the
  // collapse; the banner stays away, since no ceiling did this.
  expect(expandable(display, '1')).toBe(true)
  expect(ceilingClipped(display, '1')).toBe(false)
})

// A lane the user sized themselves still clips, and neither signal fires: what
// their own cap hides is their own doing. That used to be a second read of
// `groupMaxHeightOverrides` beside the classification; now the layout records
// whose cap it ran under, so the two cannot disagree about which lanes are
// overridden.
test('a lane clipped by its own override raises nothing', () => {
  const display = seed([
    { key: '1', label: 'HP: 1', n: 400 },
    { key: '2', label: 'HP: 2', n: 400 },
  ])
  display.setMaxHeight(40)
  expect(clippedBy(display, '1')).toBe('ceiling')

  display.toggleGroupExpanded('1')
  expect(display.groupHeightOverrides.has('1')).toBe(true)
  expect(clippedBy(display, '1')).toBe('override')
  expect(expandable(display, '1')).toBe(false)
  expect(ceilingClipped(display, '1')).toBe(false)
  // and its sibling, still on the shared budget, is unaffected
  expect(clippedBy(display, '2')).toBe('ceiling')
})

// The drag's own direction, on a lane with nothing left to reveal: it pads the
// band rather than pinning at the content, so the handle keeps tracking the
// pointer. Pinning read as the bar going dead — and in grow mode, where every
// lane shows all its reads, it was dead on every lane.
test("a drag past a fully-shown lane's content pads its band", () => {
  const display = seed([
    { key: '1', label: 'HP: 1', n: 4 },
    { key: '2', label: 'HP: 2', n: 4 },
  ])
  const band = () => display.sections.sections[0]!.pileupHeight
  const below = () => display.sections.sections[1]!.coverageTop
  expect(clippedBy(display, '1')).toBeUndefined()
  const [content, top] = [band(), below()]

  display.resizeGroupHeight('1', 100)
  expect(band()).toBe(content + 100)
  // the lane below stacks under the padded band, so the whole stack grew with it
  expect(below()).toBe(top + 100)
  // padding hides nothing, so no truncation affordance appears
  expect(clippedBy(display, '1')).toBeUndefined()
  expect(rowsIn(display, 0)).toBe(rowsIn(display, 1))

  // and the chip's "fit to view" hands the padding back
  display.toggleGroupExpanded('1')
  expect(band()).toBe(content)
})

// Fit solves one read pitch from every lane's FULL row count, so a lane the
// layout still caps at its own override shows fewer rows than the pitch was
// solved for and leaves that much of the display blank. `setHeightMode` drops
// the overrides on the explicit switch, but the resolved mode also moves without
// it — the promotable cascade writes the slot, a track reset clears the delta —
// and there `canSizeGroupHeights` has already taken away both surfaces that
// could clear one.
test('fit ignores a banked height override rather than clipping under it', () => {
  const display = seed([
    { key: '1', label: 'HP: 1', n: 400 },
    { key: '2', label: 'HP: 2', n: 400 },
  ])
  display.setMaxHeight(4000)
  display.resizeGroupHeight('1', -100)
  expect(clippedBy(display, '1')).toBe('override')

  // the mode arriving without setHeightMode, which is what leaves the override
  display.configuration.setSlot('heightMode', 'fit')
  expect(display.fitHeightToDisplay).toBe(true)
  expect(display.canSizeGroupHeights).toBe(false)

  expect(clippedBy(display, '1')).toBe('budget')
  expect(display.groupHeightOverrides.has('1')).toBe(false)
  // both lanes take the same slice, and the stack fills the display
  expect(rowsIn(display, 0)).toBe(rowsIn(display, 1))
  expect(display.sections.contentHeight).toBe(display.height)

  // inert, not dropped — leaving fit hands the lane back its own cap
  display.configuration.setSlot('heightMode', 'fixed')
  expect(clippedBy(display, '1')).toBe('override')
  expect(display.groupHeightOverrides.has('1')).toBe(true)
})
