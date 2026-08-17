import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  buildLanes,
  drawnLanesOf,
  laneExpandable,
  toSectionGroupInputs,
  zipLaneSections,
} from './lanes.ts'
import { computeStackedSections } from './sectionLayout.ts'

import type { RowCapSource } from '../RenderAlignmentDataRPC/types.ts'
import type { BuildLanesInput } from './lanes.ts'

// A laid-out lane of `rows` rows, optionally recording which cap clipped it.
// `clippedBy` is a field the layout pass writes, so a lane fixture states it
// rather than a row count to be compared back against a ceiling.
function laidOut(rows: number, clippedBy?: RowCapSource) {
  return new Map([[0, makePileupDataResult({ maxY: rows, clippedBy })]])
}

function input(overrides: Partial<BuildLanesInput> = {}): BuildLanesInput {
  return {
    order: [{ key: 'a', label: 'A' }],
    rawByGroup: new Map(),
    laidOutByGroup: new Map([['a', laidOut(4)]]),
    arcsByGroup: new Map(),
    crossRegionArcsByGroup: new Map(),
    arcInkKeys: new Set(),
    sashimiDownKeysByGroup: new Map(),
    collapsedKeys: new Set(),
    heightOverrideKeys: new Set(),
    showPileup: true,
    fitHeightToDisplay: false,
    ...overrides,
  }
}

test('a lane key with no entry in a collection gets the shared empty, not undefined', () => {
  const [lane] = buildLanes(input())
  expect(lane!.rawPileupMap.size).toBe(0)
  expect(lane!.arcsRpcDataMap.size).toBe(0)
  expect(lane!.crossRegionArcs).toEqual([])
  expect(lane!.sashimiDownKeys.size).toBe(0)
})

// The band is reserved for INK in EITHER feed. A lane whose every arc crosses a
// seam has an empty `arcsByGroup` entry and must still reserve, which is why
// this is asked of `inkGroupKeys` and not of the per-region map's keys.
test('hasArcs follows the ink key set, not the per-region arc feed', () => {
  const [lane] = buildLanes(input({ arcInkKeys: new Set(['a']) }))
  expect(lane!.hasArcs).toBe(true)
  expect(lane!.arcsRpcDataMap.size).toBe(0)
})

test('maxY is zeroed by a collapse and by showPileup off, not by either alone', () => {
  expect(buildLanes(input())[0]!.maxY).toBe(4)
  expect(buildLanes(input({ collapsedKeys: new Set(['a']) }))[0]!.maxY).toBe(0)
  expect(buildLanes(input({ showPileup: false }))[0]!.maxY).toBe(0)
})

// The two display-wide suppressions. Fit mode already clamps reads to a 1px
// floor and flags the scroll instead; with the pileup hidden there is no ink for
// the ceiling to clip.
test('ceilingClipped needs the ceiling cap AND both display-wide suppressions off', () => {
  const ceiling = { laidOutByGroup: new Map([['a', laidOut(4, 'ceiling')]]) }
  expect(buildLanes(input(ceiling))[0]!.ceilingClipped).toBe(true)
  expect(
    buildLanes(input({ ...ceiling, fitHeightToDisplay: true }))[0]!
      .ceilingClipped,
  ).toBe(false)
  expect(
    buildLanes(input({ ...ceiling, showPileup: false }))[0]!.ceilingClipped,
  ).toBe(false)
})

// A budget or a collapse can be raised out of; the ceiling and a user's own
// override cannot, and expanding either would hand back the identical cap.
test.each([
  ['budget', true],
  ['collapse', true],
  ['ceiling', false],
  ['override', false],
] as const)('laneExpandable: %s -> %s', (clippedBy, expected) => {
  const [lane] = buildLanes(
    input({ laidOutByGroup: new Map([['a', laidOut(4, clippedBy)]]) }),
  )
  expect(laneExpandable(lane)).toBe(expected)
})

test('laneExpandable: an absent lane has nothing to raise', () => {
  expect(laneExpandable(undefined)).toBe(false)
})

// A grouped fetch over a region with no reads partitions to zero lanes, and the
// section pipeline still has to produce one section.
test('drawnLanesOf substitutes the synthetic lane for an empty list', () => {
  expect(drawnLanesOf([])).toHaveLength(1)
  expect(drawnLanesOf([])[0]!.groupKey).toBe('')
  expect(drawnLanesOf([])[0]!.maxY).toBe(0)
})

// The pairing that `zipLaneSections` relies on: one section per lane, in order.
// Deriving the two lists from different sources is what used to let them
// disagree whenever a section was synthesized.
test('a section is emitted per lane, and the zip puts each one back on its own lane', () => {
  const lanes = buildLanes(
    input({
      order: [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
      ],
      laidOutByGroup: new Map([
        ['a', laidOut(4)],
        ['b', laidOut(9)],
      ]),
    }),
  )
  const { sections } = computeStackedSections(toSectionGroupInputs(lanes), {
    showCoverage: false,
    coverageHeight: 0,
    coverageYOffset: 0,
    readConnections: 'off',
    readConnectionsDown: false,
    readConnectionsHeight: 0,
    rowHeight: 10,
    showSashimiArcs: false,
    sashimiHeight: 0,
    minSectionHeight: 0,
  })
  expect(sections).toHaveLength(2)

  const zipped = zipLaneSections(lanes, sections)
  expect(zipped.map(s => s.groupKey)).toEqual(['a', 'b'])
  // Each entry carries its lane's own collections alongside its own geometry,
  // which is what retires the by-key lookup downstream.
  expect(zipped[1]!.maxY).toBe(9)
  expect(zipped[1]!.topOffset).toBe(sections[1]!.pileupTop)
  expect(zipped[0]!.topOffset).toBeLessThan(zipped[1]!.topOffset)
})
