import { makeScroll } from './components/sectionScreen.ts'
import { sectionRegionKey } from './renderers/rendererTypes.ts'
import {
  buildSectionRenders,
  computeStackedSections,
  coverageBandTop,
  laneBandHandle,
  laneBands,
  stackedBandGain,
} from './sectionLayout.ts'

import type {
  LaneBandsSettings,
  SectionLaneInput,
  SectionStackOpts,
  SectionsLayout,
} from './sectionLayout.ts'

interface TestLane extends SectionLaneInput {
  key: string
  label: string
}

// One stacked lane. Defaults to having arcs and no junction, so a test
// only names the per-lane signal it is actually about.
function lane(o: Partial<TestLane> & { key: string; maxY: number }): TestLane {
  return {
    label: o.key,
    hasArcs: true,
    hasJunctionsStripArcs: false,
    heightOverridePx: undefined,
    ...o,
  }
}

type StackOpts = Partial<LaneBandsSettings> &
  Partial<SectionStackOpts> & {
    coverageHeight: number
    rowHeight: number
  }

// The settings default to every strip off, so a case states only the bands it
// is about.
function stack(lanes: TestLane[], o: StackOpts) {
  return computeStackedSections(
    lanes,
    {
      showCoverage: o.showCoverage ?? true,
      coverageHeight: o.coverageHeight,
      drawnReadConnections: o.drawnReadConnections ?? 'off',
      readConnectionsDown: o.readConnectionsDown ?? false,
      readConnectionsAbove: o.readConnectionsAbove ?? false,
      readConnectionsHeight: o.readConnectionsHeight ?? 0,
      showJunctions: o.showJunctions ?? false,
      junctionsAbove: o.junctionsAbove ?? false,
      junctionsHeight: o.junctionsHeight ?? 0,
    },
    {
      rowHeight: o.rowHeight,
      minSectionHeight: o.minSectionHeight ?? 0,
    },
  )
}

function renders(
  layout: SectionsLayout,
  o: { scrollTop: number; canvasHeight: number },
) {
  return buildSectionRenders(
    layout,
    makeScroll(layout.sections.length, o.scrollTop, o.canvasHeight),
  )
}

type BandsInput = LaneBandsSettings & {
  hasArcs: boolean
  hasJunctionsStripArcs: boolean
}

function bandsOf({ hasArcs, hasJunctionsStripArcs, ...settings }: BandsInput) {
  return laneBands(settings, { hasArcs, hasJunctionsStripArcs })
}

// Defaults to having arcs, like `lane` above, so a case only names the data
// signal it is about.
const baseBands: BandsInput = {
  showCoverage: true,
  coverageHeight: 45,
  drawnReadConnections: 'off',
  readConnectionsDown: false,
  readConnectionsAbove: false,
  readConnectionsHeight: 40,
  showJunctions: false,
  junctionsAbove: false,
  junctionsHeight: 40,
  hasArcs: true,
  hasJunctionsStripArcs: false,
}

test('laneBands: coverage only => pileup right below coverage', () => {
  const { stack, arcBand } = bandsOf(baseBands)
  expect(stack).toMatchObject({
    top: { coverage: 0, readConnections: 45, junctions: 45 },
    reserved: { coverage: 45, readConnections: 0, junctions: 0 },
    bottom: 45,
  })
  expect(arcBand).toBeUndefined()
})

test('laneBands: below-mode arcs reserve their own band', () => {
  const r = bandsOf({
    ...baseBands,
    drawnReadConnections: 'link',
    readConnectionsDown: true,
  })
  expect(r.stack.reserved.readConnections).toBe(40)
  expect(r.stack.bottom).toBe(45 + 40)
})

// The settings say the strip MAY be reserved and no lane has an arc to put in
// it, so nothing does — the same two-halved rule `computeStackedSections`
// applies per lane, which the pooled geometry used to answer on the settings
// alone. It then sat `readConnectionsHeight` px below the pileup the sections
// laid out, and that bottom is the ungrouped scrollbar's top offset and the
// fit-to-viewport row budget's overhead.
test('laneBands: no arcs anywhere reserves no arc band', () => {
  const r = bandsOf({
    ...baseBands,
    drawnReadConnections: 'link',
    readConnectionsDown: true,
    hasArcs: false,
  })
  expect(r.stack.reserved.readConnections).toBe(0)
  expect(r.stack.bottom).toBe(45)
})

// The stacking reads each lane's band stack, so the two answers come out equal
// however the data falls.
test.each([true, false])(
  'laneBands agrees with the one section (hasArcs %s)',
  hasArcs => {
    const settings = {
      drawnReadConnections: 'link',
      readConnectionsDown: true,
      showCoverage: true,
      coverageHeight: 45,
      readConnectionsHeight: 40,
    } as const
    const bands = bandsOf({
      ...baseBands,
      ...settings,
      hasArcs,
    })
    const { sections } = stack([lane({ key: '', maxY: 3, hasArcs })], {
      ...settings,
      rowHeight: 10,
    })
    expect(sections[0]!.pileupTop).toBe(bands.stack.bottom)
    expect(sections[0]!.bands.reserved).toEqual(bands.stack.reserved)
  },
)

test('laneBands: overlay-mode arcs overlay coverage (no reserved band)', () => {
  const r = bandsOf({
    ...baseBands,
    drawnReadConnections: 'link',
    readConnectionsDown: false,
  })
  expect(r.stack.reserved.readConnections).toBe(0)
  expect(r.stack.bottom).toBe(45)
})

test('laneBands: junctions band needs coverage + a down-bound arc', () => {
  const on = bandsOf({
    ...baseBands,
    showJunctions: true,
    hasJunctionsStripArcs: true,
  })
  expect(on.stack.reserved.junctions).toBe(40)
  expect(on.stack.bottom).toBe(45 + 40)
  // nothing lands below coverage => no reserved band even when enabled
  const off = bandsOf({
    ...baseBands,
    showJunctions: true,
    hasJunctionsStripArcs: false,
  })
  expect(off.stack.reserved.junctions).toBe(0)
  expect(off.stack.bottom).toBe(45)
})

describe('where the arcs draw', () => {
  const arcs: BandsInput = {
    ...baseBands,
    drawnReadConnections: 'link',
    readConnectionsHeight: 60,
  }

  test('nowhere when read connections are off', () => {
    expect(bandsOf(baseBands).arcBand).toBeUndefined()
  })

  test('nowhere for a lane with no arcs', () => {
    expect(bandsOf({ ...arcs, hasArcs: false }).arcBand).toBeUndefined()
  })

  // Overlaying the histogram means anchoring on its baseline, the scalebar
  // inset up from the band bottom.
  test('overlay mode overlays coverage, anchored on its baseline', () => {
    expect(bandsOf({ ...arcs, coverageHeight: 80 }).arcBand).toEqual({
      top: 0,
      height: 75,
      down: false,
    })
  })

  // A coverage height below the inset is an honored state, and a negative
  // height would slip the band marks' `height > 0` gate.
  test('overlay mode over a coverage band shorter than the inset draws nothing', () => {
    expect(bandsOf({ ...arcs, coverageHeight: 3 }).arcBand?.height).toBe(0)
  })

  test('overlay mode with coverage hidden takes its whole own strip', () => {
    const bands = bandsOf({ ...arcs, showCoverage: false })
    expect(bands.arcBand).toEqual({ top: 0, height: 60, down: false })
    expect(bands.stack.bottom).toBe(60)
  })

  // A shown band of 0 px leaves nothing to overlay, so the arcs reserve their
  // strip rather than drawing over the pileup.
  test('overlay mode over a zero-height coverage band reserves its own strip', () => {
    const bands = bandsOf({ ...arcs, coverageHeight: 0 })
    expect(bands.stack.reserved.readConnections).toBe(60)
    expect(bands.arcBand).toEqual({ top: 0, height: 60, down: false })
  })

  test('below mode sits below coverage', () => {
    expect(
      bandsOf({ ...arcs, readConnectionsDown: true, coverageHeight: 80 })
        .arcBand,
    ).toEqual({ top: 80, height: 60, down: true })
  })

  test('below mode heads the stack with coverage hidden', () => {
    expect(
      bandsOf({ ...arcs, readConnectionsDown: true, showCoverage: false })
        .arcBand,
    ).toEqual({ top: 0, height: 60, down: true })
  })
})

test('sectionRegionKey: section 0 keys equal the raw region index', () => {
  // The ungrouped (section 0) path must produce byte-identical HAL keys to
  // pre-grouping so it draws exactly as before.
  expect(sectionRegionKey(0, 0)).toBe(0)
  expect(sectionRegionKey(0, 5)).toBe(5)
  expect(sectionRegionKey(0, 999)).toBe(999)
})

test('sectionRegionKey: higher sections never collide across plausible regions', () => {
  const keys = new Set<number>()
  for (let s = 0; s < 16; s++) {
    for (let r = 0; r < 1000; r++) {
      keys.add(sectionRegionKey(s, r))
    }
  }
  // 16 sections × 1000 regions, all distinct, and none hits the overlay id.
  expect(keys.size).toBe(16 * 1000)
  expect(keys.has(999999)).toBe(false)
})

test('a strip that is off spends none of its height on the stack', () => {
  // both strip heights stated large and both strips off: every top is the
  // coverage bottom, so an off band costs 0 px rather than leaking its height
  expect(
    bandsOf({
      ...baseBands,
      readConnectionsHeight: 200,
      junctionsHeight: 100,
      hasArcs: false,
    }),
  ).toMatchObject({
    stack: {
      top: { coverage: 0, readConnections: 45, junctions: 45 },
      reserved: { coverage: 45, readConnections: 0, junctions: 0 },
      bottom: 45,
    },
    arcBand: undefined,
  })
})

test('arc band then junctions band stack below coverage', () => {
  expect(
    bandsOf({
      ...baseBands,
      drawnReadConnections: 'link',
      readConnectionsDown: true,
      readConnectionsHeight: 200,
      showJunctions: true,
      junctionsHeight: 100,
      hasJunctionsStripArcs: true,
    }),
  ).toMatchObject({
    stack: {
      top: { coverage: 0, readConnections: 45, junctions: 245 },
      reserved: { coverage: 45, readConnections: 200, junctions: 100 },
      bottom: 345,
    },
    arcBand: { top: 45, height: 200, down: true },
  })
})

test('below-mode arcs reserve a band per section, pushing pileups down', () => {
  const { sections, contentHeight } = stack(
    [lane({ key: 'a', maxY: 2 }), lane({ key: 'b', maxY: 3 })],
    {
      coverageHeight: 40,
      rowHeight: 10,
      drawnReadConnections: 'link',
      readConnectionsDown: true,
      readConnectionsHeight: 100,
    },
  )
  // Each section: coverage 40 + arc band 100, then pileup.
  expect(
    sections.map(s => [s.sectionTop, s.arcBand?.top, s.pileupTop, s.maxY]),
  ).toEqual([
    [0, 40, 140, 2],
    [160, 200, 300, 3],
  ])
  expect(sections.every(s => s.arcBand?.height === 100)).toBe(true)
  expect(contentHeight).toBe(330)
})

test('an arc-less lane reserves no arc band, so the ones with arcs shift up', () => {
  const { sections, contentHeight } = stack(
    [
      lane({ key: 'notsplit', label: 'Not split', maxY: 2, hasArcs: false }),
      lane({ key: 'split', label: 'Split (SA)', maxY: 3 }),
    ],
    {
      coverageHeight: 40,
      rowHeight: 10,
      drawnReadConnections: 'link',
      readConnectionsDown: true,
      readConnectionsHeight: 100,
    },
  )
  // Lane 1 has no arcs: pileup right under its coverage (40), bottom 60. Lane 2
  // still reserves its 100px band, so 100px of dead strip is gone from the stack.
  expect(sections.map(s => [s.sectionTop, s.pileupTop])).toEqual([
    [0, 40],
    [60, 200],
  ])
  expect(sections.map(s => s.arcBand?.height)).toEqual([undefined, 100])
  expect(contentHeight).toBe(230)
})

test('an arc-less lane drops its overlay-mode draw band too', () => {
  const { sections } = stack(
    [lane({ key: 'a', maxY: 2, hasArcs: false }), lane({ key: 'b', maxY: 2 })],
    {
      coverageHeight: 40,
      rowHeight: 10,
      drawnReadConnections: 'link',
      readConnectionsDown: false,
      readConnectionsHeight: 100,
    },
  )
  // Overlay mode reserves nothing either way, so only the draw band differs.
  expect(sections.map(s => s.pileupTop)).toEqual([40, 100])
  expect(sections.map(s => s.arcBand?.height)).toEqual([undefined, 35])
})

test('the junctions strip is reserved per lane too', () => {
  const { sections } = stack(
    [
      lane({ key: 'a', maxY: 2, hasArcs: false }),
      lane({ key: 'b', maxY: 2, hasArcs: false, hasJunctionsStripArcs: true }),
    ],
    {
      coverageHeight: 40,
      rowHeight: 10,
      showJunctions: true,
      junctionsHeight: 30,
    },
  )
  // Lane a: coverage 40, pileup 40..60. Lane b starts at 60 and is the only one
  // paying the 30px strip, so its pileup starts at 60 + 40 + 30.
  expect(sections.map(s => [s.pileupTop, s.bands.reserved.junctions])).toEqual([
    [40, 0],
    [130, 30],
  ])
})

test('both strips stack for a lane that has arcs and junctions', () => {
  const { sections } = stack(
    [lane({ key: 'a', maxY: 2, hasJunctionsStripArcs: true })],
    {
      coverageHeight: 40,
      rowHeight: 10,
      drawnReadConnections: 'link',
      readConnectionsDown: true,
      readConnectionsHeight: 100,
      showJunctions: true,
      junctionsHeight: 30,
    },
  )
  expect(sections[0]).toMatchObject({
    arcBand: { top: 40, height: 100, down: true },
    bands: {
      top: { readConnections: 40, junctions: 140 },
      reserved: { readConnections: 100, junctions: 30 },
    },
    pileupTop: 170,
  })
})

// without coverage every junction is bound for the strip, which then heads
// the stack
test('the junctions strip stands on its own with coverage hidden', () => {
  const { sections } = stack(
    [lane({ key: 'a', maxY: 2, hasArcs: false, hasJunctionsStripArcs: true })],
    {
      coverageHeight: 40,
      showCoverage: false,
      rowHeight: 10,
      showJunctions: true,
      junctionsHeight: 30,
    },
  )
  expect(sections[0]).toMatchObject({
    bands: { top: { junctions: 0 }, reserved: { junctions: 30 } },
    pileupTop: 30,
  })
})

describe('the junctions strip above coverage', () => {
  const above = {
    coverageHeight: 40,
    rowHeight: 10,
    showJunctions: true,
    junctionsHeight: 30,
    junctionsAbove: true,
  }

  test('heads the stack, and the coverage band starts under it', () => {
    const layout = stack(
      [
        lane({
          key: 'a',
          maxY: 2,
          hasArcs: false,
          hasJunctionsStripArcs: true,
        }),
      ],
      above,
    )
    expect(layout.sections[0]).toMatchObject({
      sectionTop: 0,
      bands: {
        order: ['junctions', 'coverage', 'readConnections'],
        top: { junctions: 0, coverage: 30, readConnections: 70 },
        reserved: { junctions: 30, coverage: 40, readConnections: 0 },
      },
      pileupTop: 70,
    })
    expect(coverageBandTop(layout.sections[0]!)).toBe(30)
    expect(
      renders(layout, { scrollTop: 0, canvasHeight: 200 })[0],
    ).toMatchObject({
      coverageTopOffset: 30,
      junctionsBand: { top: 0, height: 30, above: true },
      pileupClipTop: 70,
    })
  })

  // its junctions are on the up mark, which draws over coverage wherever the
  // render carries no strip, so a strip stated at 0 px still says it is above
  test('stated at 0 px, still tells the render it sits above', () => {
    const layout = stack(
      [
        lane({
          key: 'a',
          maxY: 2,
          hasArcs: false,
          hasJunctionsStripArcs: true,
        }),
      ],
      { ...above, junctionsHeight: 0 },
    )
    expect(layout.sections[0]!.bands.reserved.junctions).toBe(0)
    expect(
      renders(layout, { scrollTop: 0, canvasHeight: 200 })[0]!.junctionsBand,
    ).toEqual({ top: 0, height: 0, above: true })
  })

  test('takes no px for a lane with no junction, or under another placement', () => {
    const empty = stack([lane({ key: 'a', maxY: 2, hasArcs: false })], above)
    expect(empty.sections[0]).toMatchObject({
      bands: { top: { coverage: 0 }, reserved: { junctions: 0 } },
      pileupTop: 40,
    })
    const below = stack(
      [
        lane({
          key: 'a',
          maxY: 2,
          hasArcs: false,
          hasJunctionsStripArcs: true,
        }),
      ],
      { ...above, junctionsAbove: false },
    )
    expect(below.sections[0]).toMatchObject({
      bands: {
        top: { coverage: 0, junctions: 40 },
        reserved: { junctions: 30 },
      },
    })
    expect(
      renders(below, { scrollTop: 0, canvasHeight: 200 })[0],
    ).toMatchObject({
      coverageTopOffset: 0,
      junctionsBand: { top: 40, height: 30, above: false },
    })
  })

  test('each grouped lane stacks its own strip over its own coverage', () => {
    const layout = stack(
      [
        lane({
          key: 'a',
          maxY: 2,
          hasArcs: false,
          hasJunctionsStripArcs: true,
        }),
        lane({
          key: 'b',
          maxY: 2,
          hasArcs: false,
          hasJunctionsStripArcs: true,
        }),
      ],
      above,
    )
    expect(
      layout.sections.map(s => [s.sectionTop, coverageBandTop(s)]),
    ).toEqual([
      [0, 30],
      [90, 120],
    ])
    expect(
      renders(layout, { scrollTop: 10, canvasHeight: 400 }).map(r => [
        r.junctionsBand?.top,
        r.coverageTopOffset,
      ]),
    ).toEqual([
      [-10, 20],
      [80, 110],
    ])
  })

  test('the strip resizes from its seam with the coverage band', () => {
    const { sections } = stack(
      [
        lane({
          key: 'a',
          maxY: 2,
          hasArcs: false,
          hasJunctionsStripArcs: true,
        }),
        lane({
          key: 'b',
          maxY: 2,
          hasArcs: false,
          hasJunctionsStripArcs: true,
        }),
      ],
      above,
    )
    expect(laneBandHandle(sections, 1, 'junctions', true)).toEqual({
      seam: 120,
      gain: 2,
      reverse: false,
    })
    expect(laneBandHandle(sections, 1, 'junctions', false)).toEqual({
      seam: 120,
      gain: 1,
      reverse: false,
    })
  })

  test('keeps its place and its arcs rising with coverage hidden', () => {
    const layout = stack(
      [
        lane({
          key: 'a',
          maxY: 2,
          hasArcs: false,
          hasJunctionsStripArcs: true,
        }),
      ],
      { ...above, showCoverage: false },
    )
    expect(layout.sections[0]).toMatchObject({
      bands: {
        top: { junctions: 0 },
        reserved: { junctions: 30, coverage: 0 },
      },
      pileupTop: 30,
    })
    expect(
      renders(layout, { scrollTop: 0, canvasHeight: 200 })[0]!.junctionsBand,
    ).toEqual({ top: 0, height: 30, above: true })
  })
})

describe('the read connections strip above coverage', () => {
  const above = {
    coverageHeight: 40,
    rowHeight: 10,
    drawnReadConnections: 'link' as const,
    readConnectionsHeight: 50,
    readConnectionsAbove: true,
  }

  test('heads the stack with its arcs rising, and overlays nothing', () => {
    const layout = stack([lane({ key: 'a', maxY: 2 })], above)
    expect(layout.sections[0]).toMatchObject({
      bands: {
        top: { readConnections: 0, coverage: 50, junctions: 90 },
        reserved: { readConnections: 50, coverage: 40, junctions: 0 },
      },
      arcBand: { top: 0, height: 50, down: false },
      pileupTop: 90,
    })
    expect(
      renders(layout, { scrollTop: 0, canvasHeight: 200 })[0],
    ).toMatchObject({
      coverageTopOffset: 50,
      arcBand: { top: 0, height: 50, down: false },
    })
  })

  test('takes no px for a lane with no arcs', () => {
    const layout = stack([lane({ key: 'a', maxY: 2, hasArcs: false })], above)
    expect(layout.sections[0]).toMatchObject({
      bands: { top: { coverage: 0 }, reserved: { readConnections: 0 } },
      arcBand: undefined,
      pileupTop: 40,
    })
  })

  test('keeps its place and its arcs rising with coverage hidden', () => {
    const layout = stack([lane({ key: 'a', maxY: 2 })], {
      ...above,
      showCoverage: false,
    })
    expect(layout.sections[0]).toMatchObject({
      bands: {
        order: ['readConnections', 'coverage', 'junctions'],
        reserved: { readConnections: 50, coverage: 0 },
      },
      arcBand: { top: 0, height: 50, down: false },
      pileupTop: 50,
    })
  })

  test('with both strips above, read connections lead as they do below', () => {
    const layout = stack(
      [lane({ key: 'a', maxY: 2, hasJunctionsStripArcs: true })],
      {
        ...above,
        showJunctions: true,
        junctionsHeight: 30,
        junctionsAbove: true,
      },
    )
    expect(layout.sections[0]).toMatchObject({
      bands: {
        order: ['readConnections', 'junctions', 'coverage'],
        top: { readConnections: 0, junctions: 50, coverage: 80 },
      },
      arcBand: { top: 0, height: 50, down: false },
      pileupTop: 120,
    })
    expect(
      renders(layout, { scrollTop: 0, canvasHeight: 200 })[0],
    ).toMatchObject({
      coverageTopOffset: 80,
      junctionsBand: { top: 50, height: 30, above: true },
    })
  })
})

test('overlay-mode arcs overlay coverage: no reserved band, draw band at coverage top', () => {
  const { sections } = stack(
    [lane({ key: 'a', maxY: 2 }), lane({ key: 'b', maxY: 2 })],
    {
      coverageHeight: 40,
      rowHeight: 10,
      drawnReadConnections: 'link',
      readConnectionsDown: false,
      readConnectionsHeight: 100,
    },
  )
  // No reserved arc band: pileup sits right under coverage (40), section 2
  // starts at 40 + 20 = 60. Arc draw band overlays the coverage band.
  expect(sections.map(s => [s.sectionTop, s.pileupTop])).toEqual([
    [0, 40],
    [60, 100],
  ])
  expect(sections[0]!.arcBand).toMatchObject({ top: 0, height: 35 })
  expect(sections[1]!.arcBand).toMatchObject({ top: 60, height: 35 })
})

test('single section stacks coverage then pileup from the top', () => {
  const { sections, contentHeight } = stack([lane({ key: '', maxY: 4 })], {
    coverageHeight: 45,
    rowHeight: 10,
  })
  expect(sections).toHaveLength(1)
  expect(sections[0]).toMatchObject({
    sectionTop: 0,
    bands: { reserved: { coverage: 45 } },
    pileupTop: 45,
    pileupHeight: 40,
  })
  expect(contentHeight).toBe(85)
})

test("stackedBandGain counts a handle's own band plus the ones above it", () => {
  const { sections } = stack(
    [
      lane({ key: 'a', maxY: 1 }),
      lane({ key: 'b', maxY: 1, hasArcs: false }),
      lane({ key: 'c', maxY: 1 }),
    ],
    {
      coverageHeight: 40,
      rowHeight: 10,
      drawnReadConnections: 'link',
      readConnectionsDown: true,
      readConnectionsHeight: 30,
    },
  )
  // the top handle only moves by its own band; the third sits below two others
  expect(stackedBandGain(sections, 0, 'readConnections')).toBe(1)
  expect(stackedBandGain(sections, 2, 'readConnections')).toBe(2)
  // a coverage band is reserved by every section, so its gain is the index + 1
  expect(stackedBandGain(sections, 2, 'coverage')).toBe(3)
})

test('a drag-set height pads the band past its rows, and stacks the rest below', () => {
  const { sections, contentHeight } = stack(
    [
      lane({ key: '1', maxY: 3, heightOverridePx: 120 }),
      lane({ key: '2', maxY: 5 }),
    ],
    { coverageHeight: 20, rowHeight: 10 },
  )
  // 30px of rows in a 120px band: the surplus draws blank, and section 2 starts
  // below the padded band rather than below the rows.
  expect(
    sections.map(s => [s.sectionTop, s.pileupTop, s.pileupHeight]),
  ).toEqual([
    [0, 20, 120],
    [140, 160, 50],
  ])
  expect(contentHeight).toBe(210)
})

test('a lane drawing no rows is not padded by a banked height override', () => {
  // Collapsed (maxY 0) with an override still banked from before the collapse:
  // padding it would reopen the band the collapse just closed.
  const { sections, contentHeight } = stack(
    [lane({ key: '1', maxY: 0, heightOverridePx: 120 })],
    { coverageHeight: 20, rowHeight: 10 },
  )
  expect(sections[0]).toMatchObject({ pileupHeight: 0 })
  expect(contentHeight).toBe(20)
})

test('multiple sections stack with each coverage above its own pileup', () => {
  const { sections, contentHeight } = stack(
    [
      lane({ key: '1', label: 'HP: 1', maxY: 3 }),
      lane({ key: '2', label: 'HP: 2', maxY: 5 }),
    ],
    { coverageHeight: 20, rowHeight: 10 },
  )
  expect(
    sections.map(s => [s.sectionTop, s.pileupTop, s.pileupHeight]),
  ).toEqual([
    [0, 20, 30],
    [50, 70, 50],
  ])
  // read connections off: no section draws or reserves them
  expect(sections.every(s => s.arcBand === undefined)).toBe(true)
  expect(contentHeight).toBe(120)
})

test('coverageHeight 0 (coverage hidden) collapses each section to its pileup', () => {
  const { sections } = stack(
    [lane({ key: 'a', maxY: 2 }), lane({ key: 'b', maxY: 2 })],
    { coverageHeight: 0, rowHeight: 10 },
  )
  expect(sections[0]!.pileupTop).toBe(0)
  expect(sections[1]!.pileupTop).toBe(20)
})

test('laneBands: coverage off spends 0px', () => {
  // The `active` half of the coverage band. `computeStackedSections`' twin is
  // pinned below; this one was not, so `active: s.showCoverage` could be
  // replaced by `true` with the suite green.
  const { stack } = bandsOf({ ...baseBands, showCoverage: false })
  expect(stack.bottom).toBe(0)
  expect(stack.reserved.coverage).toBe(0)
})

// The arcs draw in the strip the section reserves for them, off one number. A
// draw band sized from the raw slot while the strip was reserved at the bound
// one drew over the junctions strip and the pileup below it.
test('the below-mode arc draw band is the strip the section reserves', () => {
  const { sections } = stack([lane({ key: '', maxY: 4 })], {
    coverageHeight: 45,
    rowHeight: 10,
    drawnReadConnections: 'link',
    readConnectionsDown: true,
    readConnectionsHeight: 35,
  })
  const s = sections[0]!
  expect(s.arcBand!.top).toBe(s.sectionTop + s.bands.reserved.coverage)
  expect(s.arcBand!.top + s.arcBand!.height).toBe(s.pileupTop)
})

const ungrouped: SectionsLayout = stack([lane({ key: '', maxY: 4 })], {
  coverageHeight: 45,
  rowHeight: 10,
})

const grouped: SectionsLayout = stack(
  [
    lane({ key: '1', label: 'HP: 1', maxY: 3 }),
    lane({ key: '2', label: 'HP: 2', maxY: 5 }),
  ],
  { coverageHeight: 20, rowHeight: 10 },
)

test('buildSectionRenders: ungrouped keeps coverage sticky and clips the pileup at its band', () => {
  // scrollTop must NOT move the ungrouped coverage band (sticky) or its clips.
  const out = renders(ungrouped, {
    scrollTop: 37,
    canvasHeight: 600,
  })
  expect(out).toEqual([
    {
      pileupTopOffset: 45,
      coverageTopOffset: 0,
      pileupClipTop: 45,
      // 4 rows of 10 scrolled up by 37: the band ends 3 px below the ceiling
      pileupClipHeight: 3,
      connectorClipHeight: 555,
      arcBand: undefined,
      junctionsBand: undefined,
    },
  ])
})

// A row cap parks its overflow reads on the row just below the last, where
// PileupTruncationRule draws; a track taller than the capped pileup must not
// paint them there.
test('buildSectionRenders: an ungrouped pileup shorter than the canvas clips at its last row', () => {
  const [render] = renders(ungrouped, {
    scrollTop: 0,
    canvasHeight: 600,
  })
  expect(render?.pileupClipHeight).toBe(40)
  const [tall] = renders(ungrouped, {
    scrollTop: 0,
    canvasHeight: 60,
  })
  expect(tall?.pileupClipHeight).toBe(15)
})

test('buildSectionRenders: grouped scrolls each whole section band by scrollTop', () => {
  const out = renders(grouped, {
    scrollTop: 10,
    canvasHeight: 600,
  })
  // Section tops from `grouped`: cov 0/pileup 20 (h30), cov 50/pileup 70 (h50).
  expect(out).toEqual([
    {
      pileupTopOffset: 20,
      coverageTopOffset: -10,
      pileupClipTop: 10,
      pileupClipHeight: 30,
      connectorClipHeight: 590,
      arcBand: undefined,
      junctionsBand: undefined,
    },
    {
      pileupTopOffset: 70,
      coverageTopOffset: 40,
      pileupClipTop: 60,
      pileupClipHeight: 50,
      connectorClipHeight: 540,
      arcBand: undefined,
      junctionsBand: undefined,
    },
  ])
})

// A connector dipping below its section's last row draws over the next
// section, where the reads a row cap parked do not paint.
test('buildSectionRenders: the connector band runs to the bottom of the canvas', () => {
  const [first, second] = renders(grouped, {
    scrollTop: 0,
    canvasHeight: 90,
  })
  expect(first?.pileupClipHeight).toBe(30)
  expect(first?.connectorClipHeight).toBe(70)
  expect(second?.connectorClipHeight).toBe(20)
})

test('buildSectionRenders: grouped pileupTopOffset is content-space (scroll via shader)', () => {
  // The pileup top offset is NOT pre-scrolled — the shader subtracts scrollTop
  // (rangeY0). Only the coverage band and clip bands carry the scroll.
  const a = renders(grouped, { scrollTop: 0, canvasHeight: 600 })
  const b = renders(grouped, { scrollTop: 100, canvasHeight: 600 })
  expect(a.map(s => s.pileupTopOffset)).toEqual(b.map(s => s.pileupTopOffset))
})

// Below-mode arc layouts for the arcBand screen-geometry tests.
const ungroupedArcs: SectionsLayout = stack([lane({ key: '', maxY: 4 })], {
  coverageHeight: 40,
  rowHeight: 10,
  drawnReadConnections: 'link',
  readConnectionsDown: true,
  readConnectionsHeight: 100,
})

const groupedArcs: SectionsLayout = stack(
  [lane({ key: 'a', maxY: 2 }), lane({ key: 'b', maxY: 3 })],
  {
    coverageHeight: 40,
    rowHeight: 10,
    drawnReadConnections: 'link',
    readConnectionsDown: true,
    readConnectionsHeight: 100,
  },
)

test('buildSectionRenders: ungrouped arc band is sticky (scroll does not move it)', () => {
  // Coverage + arc band are sticky in ungrouped mode, so the band keeps its
  // content-space top (40 = below the 40px coverage) regardless of scroll.
  const a = renders(ungroupedArcs, { scrollTop: 0, canvasHeight: 600 }) // prettier-ignore
  const b = renders(ungroupedArcs, { scrollTop: 250, canvasHeight: 600 }) // prettier-ignore
  expect(a[0]!.arcBand).toEqual({ top: 40, height: 100, down: true })
  expect(b[0]!.arcBand).toEqual({ top: 40, height: 100, down: true })
})

test('buildSectionRenders: grouped arc band scrolls with its section', () => {
  // Section a: cov 0, arc 40, pileup 140 (+20 rows) => bottom 160.
  // Section b: cov 160, arc 200. Each arc band shifts up by scrollTop, the same
  // as its coverage band.
  const out = renders(groupedArcs, {
    scrollTop: 30,
    canvasHeight: 600,
  })
  expect(out[0]!.arcBand).toEqual({ top: 10, height: 100, down: true })
  expect(out[1]!.arcBand).toEqual({ top: 170, height: 100, down: true })
})

test('buildSectionRenders: no arc band reserved => arcBand undefined', () => {
  expect(
    renders(grouped, { scrollTop: 0, canvasHeight: 600 })[0]!.arcBand,
  ).toBeUndefined()
})

// One-row-per-group layouts make sections shorter than their own label chips,
// which are anchored at each section's top. Without a floor the chips stack on
// top of each other and every label but the last is unreadable.
test('minSectionHeight floors the advance to the next section, not the pileup', () => {
  const { sections, contentHeight } = stack(
    [
      lane({ key: 'a', maxY: 1 }),
      lane({ key: 'b', maxY: 1 }),
      lane({ key: 'c', maxY: 1 }),
    ],
    {
      coverageHeight: 0,
      showCoverage: false,
      rowHeight: 8,
      minSectionHeight: 16,
    },
  )
  expect(sections.map(s => [s.pileupTop, s.pileupHeight])).toEqual([
    [0, 8],
    [16, 8],
    [32, 8],
  ])
  expect(contentHeight).toBe(48)
})

// A connector dipping below its section's last row draws over the next
// section, so the stacking keeps no room for it.
test('a section advances by its rows alone', () => {
  const { sections, contentHeight } = stack(
    [
      lane({ key: 'split', maxY: 4 }),
      lane({ key: 'notSplit', maxY: 4 }),
      lane({ key: 'collapsed', maxY: 0 }),
    ],
    { coverageHeight: 0, showCoverage: false, rowHeight: 8 },
  )
  expect(sections.map(s => [s.pileupTop, s.pileupHeight, s.height])).toEqual([
    [0, 32, 32],
    [32, 32, 32],
    [64, 0, 0],
  ])
  expect(contentHeight).toBe(64)
})

test('minSectionHeight is inert once a section is taller than it', () => {
  const tall = [lane({ key: 'a', maxY: 4 }), lane({ key: 'b', maxY: 4 })]
  const opts = { coverageHeight: 0, showCoverage: false, rowHeight: 8 }
  expect(stack(tall, { ...opts, minSectionHeight: 16 })).toEqual(
    stack(tall, opts),
  )
})
