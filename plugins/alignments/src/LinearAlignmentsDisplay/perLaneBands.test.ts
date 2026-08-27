import { SAM_FLAG_PAIRED } from '@jbrowse/cigar-utils'

import { namesToBlock } from '../shared/readNameBlock.ts'
import { nextRefsToTable } from '../shared/readNextRefs.ts'
import {
  makeEmptyAlignmentsResult,
  makeEmptyPileupData,
  bootAlignmentsDisplay,
  oneReadWithMate as oneRead,
} from './testUtils.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'

// `n` reads stacked at one position, so the lane lays out exactly `n` rows —
// enough of them that the fit pitch lands under the Normal cap and a change in
// the budget is visible in it. `mateBp` pairs the FIRST read, which is all
// `computeArcsFromPileupData` needs to give the lane an arc.
function stackedLane(n: number, mateBp?: number): WorkerPileupData {
  const positions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    positions[i * 2] = 1000
    positions[i * 2 + 1] = 1100
  }
  const paired = (i: number) => mateBp !== undefined && i === 0
  return {
    ...makeEmptyPileupData(),
    readKeys: Array.from({ length: n }, (_, i) => `r${i}`),
    ...namesToBlock(Array.from({ length: n }, (_, i) => `read${i}`)),
    readPositions: positions,
    readFlags: Uint16Array.from(
      Array.from({ length: n }, (_, i) => (paired(i) ? SAM_FLAG_PAIRED : 0)),
    ),
    readMapqs: new Uint8Array(n),
    readStrands: new Int8Array(n).fill(1),
    readInsertSizes: new Float32Array(n).fill(500),
    readPairOrientations: new Uint8Array(n).fill(1),
    ...nextRefsToTable(
      Array.from({ length: n }, (_, i) => (paired(i) ? 'ctgA' : '')),
    ),
    readNextPositions: Uint32Array.from(
      Array.from({ length: n }, (_, i) => (paired(i) ? mateBp! : 0)),
    ),
  }
}

import type { SectionsLayout } from './sectionLayout.ts'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Boots a real LinearAlignmentsDisplay in a measured view, so the per-lane band
// decision is exercised through the actual `arcsByGroup` → `sections` chain
// rather than by calling `computeStackedSections` directly (sectionLayout.test.ts
// covers the pure function).
function createEnv() {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay()
  // `arcsByGroup` normalizes SA/RNEXT refNames through the assembly, so the mock
  // has to answer `initialized` + `getCanonicalRefName2`.
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
  return { view, display }
}

// Two lanes, only the second holding a pair, with down-mode arcs on so the band
// is a reserved strip rather than a coverage overlay.
function twoLanes() {
  const { view, display } = createEnv()
  display.setReadConnections('arc')
  display.setReadConnectionsDown(true)
  display.setRpcData(0, {
    groups: [
      { key: 'notsplit', label: 'Not split', data: oneRead() },
      { key: 'split', label: 'Split (SA)', data: oneRead(2000) },
    ],
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  })
  return { view, display }
}

test('only the lane with arcs reserves the arc band', () => {
  const { display } = twoLanes()
  const layout: SectionsLayout = display.sections
  const sections = layout.sections
  expect(sections.map(s => [s.groupKey, s.hasArcsBand])).toEqual([
    ['notsplit', false],
    ['split', true],
  ])
  // The arc-less lane's pileup starts right at its coverage bottom; the lane
  // with arcs is pushed down by the whole band.
  const [notsplit, split] = sections
  expect(notsplit!.pileupTop - notsplit!.coverageTop).toBe(
    display.coverageHeight,
  )
  expect(split!.pileupTop - split!.coverageTop).toBe(
    display.coverageHeight + display.readConnectionsHeight,
  )
})

test('the reserved band tracks the arc feed, not just the setting', () => {
  const { display } = twoLanes()
  const withArcs = display.sections.contentHeight
  // Same reads, but now nothing pairs => neither lane has an arc to draw, so
  // both strips go away and the whole stack shortens by one band.
  display.setRpcData(0, {
    groups: [
      { key: 'notsplit', label: 'Not split', data: oneRead() },
      { key: 'split', label: 'Split (SA)', data: oneRead() },
    ],
  })
  const layout: SectionsLayout = display.sections
  expect(layout.sections.every(s => !s.hasArcsBand)).toBe(true)
  expect(display.sections.contentHeight).toBe(
    withArcs - display.readConnectionsHeight,
  )
})

test('turning read connections off drops the band from the lane that had one', () => {
  const { display } = twoLanes()
  const withArcs = display.sections.contentHeight
  display.setReadConnections('off')
  // Connections are an rpcProps setting — the worker skips the per-read SA tag
  // walk when they are off — so toggling drops the fetched data. Re-seed it
  // here, standing in for the refetch, since what this test is about is the
  // band the layout reserves rather than the invalidation.
  display.setRpcData(0, {
    groups: [
      { key: 'notsplit', label: 'Not split', data: oneRead() },
      { key: 'split', label: 'Split (SA)', data: oneRead(2000) },
    ],
  })
  const layout: SectionsLayout = display.sections
  expect(layout.sections.every(s => !s.hasArcsBand)).toBe(true)
  expect(display.sections.contentHeight).toBe(
    withArcs - display.readConnectionsHeight,
  )
})

// Arc strips are reserved PER SECTION, so a grouped read cloud has one band per
// lane — and the ruler that labels the |TLEN| axis has to have one per lane too.
// It did not: `insertSizeTicks` built a single bar from
// `computeArcBand(self.arcBandInput)`, a section-RELATIVE band, and both hosts
// placed it at content y 0. The values were right for every lane (the domain is
// pooled across groups by `arcsYDomainBp`) but only the first lane's band had
// anything beside it. `CoverageScaleBars` had solved the same problem by mapping
// over sections; this is that.
describe('the read cloud rules every lane that reserves an arc band', () => {
  // Both lanes carrying a pair, so both reserve a band. Read cloud rather than
  // arc mode, since only read cloud puts |TLEN| on the axis at all.
  function twoCloudLanes() {
    const { view, display } = createEnv()
    display.setReadConnections('cloud')
    display.setReadConnectionsDown(true)
    display.setRpcData(0, {
      groups: [
        { key: 'a', label: 'Lane A', data: oneRead(2000) },
        { key: 'b', label: 'Lane B', data: oneRead(3000) },
      ],
    })
    display.setLoadedRegion(0, {
      refName: 'ctgA',
      start: 0,
      end: 10_000,
      assemblyName: 'volvox',
    })
    return { view, display }
  }

  // The harness's `display` is the loosely-typed MST instance the session hands
  // back, so name what this getter returns once rather than at four call sites.
  type Ruler = { groupKey: string; ticks: YScaleTicks }
  const rulers = (display: { insertSizeTickSections: Ruler[] }): Ruler[] =>
    display.insertSizeTickSections

  test('one ruler per banded lane, named by its group', () => {
    const { display } = twoCloudLanes()
    const layout: SectionsLayout = display.sections
    expect(layout.sections.every(s => s.hasArcsBand)).toBe(true)
    expect(rulers(display).map(s => s.groupKey)).toEqual(['a', 'b'])
  })

  test('each ruler sits on its own lane’s band, in content space', () => {
    const { display } = twoCloudLanes()
    const bands = display.renderSections
    for (const [i, { ticks }] of rulers(display).entries()) {
      const band = bands[i]!
      // Down mode anchors at the band top, so the baseline tick (value 1, log
      // fraction 0) lands exactly there — the same `arcAnchorY` the arcs take.
      expect(ticks.items[0]!.value).toBe(1)
      expect(ticks.items[0]!.y).toBe(band.arcBandTop)
      expect(ticks.yTop).toBe(band.arcBandTop)
    }
  })

  test('the second lane’s ruler is genuinely lower than the first', () => {
    // The regression this exists for: one bar for the whole track put every
    // section's ticks at the first section's band.
    const { display } = twoCloudLanes()
    const [a, b] = rulers(display)
    if (!a || !b) {
      throw new Error('expected a ruler for each of the two lanes')
    }
    expect(b.ticks.yTop).toBeGreaterThan(a.ticks.yTop)
  })

  test('a lane with no arc band gets no ruler', () => {
    // Same gate the renderers use to skip the pass: no arcs, no band, so
    // nothing to label. Lane A pairs, lane B does not.
    const { display } = createEnv()
    display.setReadConnections('cloud')
    display.setReadConnectionsDown(true)
    display.setRpcData(0, {
      groups: [
        { key: 'a', label: 'Lane A', data: oneRead(2000) },
        { key: 'b', label: 'Lane B', data: oneRead() },
      ],
    })
    display.setLoadedRegion(0, {
      refName: 'ctgA',
      start: 0,
      end: 10_000,
      assemblyName: 'volvox',
    })
    expect(rulers(display).map(s => s.groupKey)).toEqual(['a'])
  })

  test('arc mode has no |TLEN| axis to rule', () => {
    const { display } = twoCloudLanes()
    display.setReadConnections('arc')
    expect(rulers(display)).toEqual([])
  })
})

// `belowCoverageBands` is the pooled twin of the per-section stacking: one
// answer for a display, where `computeStackedSections` gives one per lane. It
// resolved the arc strip from the SETTINGS alone while the sections resolved it
// from the settings AND the lane's arcs, so with connections on and nothing
// paired the two disagreed by `readConnectionsHeight`. Its `bottom` is the
// ungrouped scrollbar's top offset and the fit-to-viewport row budget's
// per-group overhead, so both spent a strip no lane drew in.
describe('the pooled below-coverage bands agree with the sections', () => {
  function ungrouped(mateBp?: number) {
    const { display } = createEnv()
    display.setReadConnections('arc')
    display.setReadConnectionsDown(true)
    display.setRpcData(0, {
      groups: [{ key: '', label: '', data: oneRead(mateBp) }],
    })
    display.setLoadedRegion(0, {
      refName: 'ctgA',
      start: 0,
      end: 10_000,
      assemblyName: 'volvox',
    })
    return display
  }

  test('an unpaired ungrouped pileup reserves no arc strip either way', () => {
    const display = ungrouped()
    const layout: SectionsLayout = display.sections
    expect(layout.sections[0]!.hasArcsBand).toBe(false)
    expect(display.belowCoverageBands.hasArcsBand).toBe(false)
    expect(display.coverageDisplayHeight).toBe(display.coverageHeight)
    expect(layout.sections[0]!.pileupTop).toBe(display.coverageDisplayHeight)
  })

  test('a paired ungrouped pileup reserves it in both', () => {
    const display = ungrouped(2000)
    const layout: SectionsLayout = display.sections
    expect(layout.sections[0]!.hasArcsBand).toBe(true)
    expect(display.belowCoverageBands.hasArcsBand).toBe(true)
    expect(display.coverageDisplayHeight).toBe(
      display.coverageHeight + display.readConnectionsHeight,
    )
    expect(layout.sections[0]!.pileupTop).toBe(display.coverageDisplayHeight)
  })

  // The other consumer: `fitGroupMaxRows` subtracts this bottom once per group
  // before dividing the viewport into rows. With no lane paired, connections on
  // has exactly as much room for rows as connections off.
  test('the fit row budget spends nothing on a strip no lane has', () => {
    const seedTwoUnpairedLanes = (connections: 'arc' | 'off') => {
      const { display } = createEnv()
      display.setHeightMode('fit')
      display.setReadConnections(connections)
      display.setReadConnectionsDown(true)
      display.setGroupBy({ type: 'strand' })
      display.setRpcData(0, {
        groups: [
          { key: '+', label: 'Forward strand', data: oneRead() },
          { key: '-', label: 'Reverse strand', data: oneRead() },
        ],
      })
      display.setLoadedRegion(0, {
        refName: 'ctgA',
        start: 0,
        end: 10_000,
        assemblyName: 'volvox',
      })
      return display
    }
    const on = seedTwoUnpairedLanes('arc')
    const off = seedTwoUnpairedLanes('off')
    expect(on.coverageDisplayHeight).toBe(off.coverageDisplayHeight)
    expect(on.fittedFeatureHeight).toBe(off.fittedFeatureHeight)
    expect(on.sections.contentHeight).toBe(off.sections.contentHeight)
  })

  // And the half above leaves open: the budget is a SUM over the lanes, not one
  // lane's answer times the lane count. `computeStackedSections` reserves the
  // strip per lane, so a stack where only one lane pairs draws one strip — and a
  // budget charging every lane for it withholds the others' worth of viewport
  // from the rows, which is dead space at the bottom of a mode whose whole
  // promise is filling the display.
  test('a strip one lane of two has is charged once, not twice', () => {
    const seed = (secondLaneMate: number | undefined) => {
      const { display } = createEnv()
      display.setHeightMode('fit')
      display.setReadConnections('arc')
      display.setReadConnectionsDown(true)
      display.setGroupBy({ type: 'strand' })
      display.setRpcData(0, {
        groups: [
          { key: '+', label: 'Forward strand', data: stackedLane(20, 2000) },
          {
            key: '-',
            label: 'Reverse strand',
            data: stackedLane(20, secondLaneMate),
          },
        ],
      })
      display.setLoadedRegion(0, {
        refName: 'ctgA',
        start: 0,
        end: 10_000,
        assemblyName: 'volvox',
      })
      return display
    }
    const bothPaired = seed(3000)
    const onePaired = seed(undefined)
    // The premise: two strips drawn against one.
    expect(bothPaired.sections.sections.map(s => s.hasArcsBand)).toEqual([
      true,
      true,
    ])
    expect(onePaired.sections.sections.map(s => s.hasArcsBand)).toEqual([
      true,
      false,
    ])
    // So the lane without one hands its strip's height back to the rows. Both
    // stacks have the same 40 rows, so the pitch grows by exactly the strip
    // spread over them.
    const rows = 40
    expect(onePaired.fittedFeatureHeight).toBeCloseTo(
      bothPaired.fittedFeatureHeight + onePaired.readConnectionsHeight / rows,
      6,
    )
  })
})
