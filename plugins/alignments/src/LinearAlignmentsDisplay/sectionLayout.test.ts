import { sectionRegionKey } from './renderers/rendererTypes.ts'
import {
  belowCoverageBandsGeometry,
  buildSectionRenders,
  computeStackedSections,
} from './sectionLayout.ts'

import type {
  BelowCoverageBandsInput,
  SectionGroupInput,
  SectionsLayout,
} from './sectionLayout.ts'

// One stacked lane. Defaults to having arcs and no sashimi junction, so a test
// only names the per-lane signal it is actually about; `label` falls back to the
// key, which is what every test but the labelled-grouping ones wants.
function lane(
  o: Partial<SectionGroupInput> & { key: string; maxY: number },
): SectionGroupInput {
  return { label: o.key, hasArcs: true, hasSashimiDownArcs: false, ...o }
}

// Defaults to having arcs, like `lane` above, so a case only names the data
// signal it is about.
const baseBands: BelowCoverageBandsInput = {
  showCoverage: true,
  coverageHeight: 45,
  readConnections: 'off',
  readConnectionsDown: false,
  readConnectionsHeight: 40,
  showSashimiArcs: false,
  sashimiArcsHeight: 40,
  hasArcs: true,
  hasSashimiDownArcs: false,
}

test('belowCoverageBandsGeometry: coverage only => pileup right below coverage', () => {
  expect(belowCoverageBandsGeometry(baseBands)).toEqual({
    coverageHeight: 45,
    hasArcsBand: false,
    hasSashimiBand: false,
    arcsBandTop: 45,
    sashimiBandTop: 45,
    bottom: 45,
  })
})

test('belowCoverageBandsGeometry: down-mode arcs reserve their own band', () => {
  const r = belowCoverageBandsGeometry({
    ...baseBands,
    readConnections: 'arc',
    readConnectionsDown: true,
  })
  expect(r.hasArcsBand).toBe(true)
  expect(r.bottom).toBe(45 + 40)
})

// The settings say the strip MAY be reserved and no lane has an arc to put in
// it, so nothing does — the same two-halved rule `computeStackedSections`
// applies per lane, which the pooled geometry used to answer on the settings
// alone. It then sat `readConnectionsHeight` px below the pileup the sections
// laid out, and that bottom is the ungrouped scrollbar's top offset and the
// fit-to-viewport row budget's overhead.
test('belowCoverageBandsGeometry: no arcs anywhere reserves no arc band', () => {
  const r = belowCoverageBandsGeometry({
    ...baseBands,
    readConnections: 'arc',
    readConnectionsDown: true,
    hasArcs: false,
  })
  expect(r.hasArcsBand).toBe(false)
  expect(r.bottom).toBe(45)
})

// The ungrouped case is one lane, so the two answers are the same statement and
// have to come out equal however the data falls.
test.each([true, false])(
  'belowCoverageBandsGeometry agrees with the one section (hasArcs %s)',
  hasArcs => {
    const settings = {
      readConnections: 'arc',
      readConnectionsDown: true,
      showCoverage: true,
      coverageHeight: 45,
      readConnectionsHeight: 40,
    } as const
    const bands = belowCoverageBandsGeometry({
      ...baseBands,
      ...settings,
      hasArcs,
    })
    const { sections } = computeStackedSections(
      [lane({ key: '', maxY: 3, hasArcs })],
      { ...settings, rowHeight: 10 },
    )
    expect(sections[0]!.pileupTop).toBe(bands.bottom)
    expect(sections[0]!.hasArcsBand).toBe(bands.hasArcsBand)
  },
)

test('belowCoverageBandsGeometry: up-mode arcs overlay coverage (no reserved band)', () => {
  const r = belowCoverageBandsGeometry({
    ...baseBands,
    readConnections: 'arc',
    readConnectionsDown: false,
  })
  expect(r.hasArcsBand).toBe(false)
  expect(r.bottom).toBe(45)
})

test('belowCoverageBandsGeometry: sashimi band needs coverage + a down-bound arc', () => {
  const on = belowCoverageBandsGeometry({
    ...baseBands,
    showSashimiArcs: true,
    hasSashimiDownArcs: true,
  })
  expect(on.hasSashimiBand).toBe(true)
  expect(on.bottom).toBe(45 + 40)
  // nothing lands below coverage => no reserved band even when enabled
  const off = belowCoverageBandsGeometry({
    ...baseBands,
    showSashimiArcs: true,
    hasSashimiDownArcs: false,
  })
  expect(off.hasSashimiBand).toBe(false)
  expect(off.bottom).toBe(45)
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
    belowCoverageBandsGeometry({
      ...baseBands,
      readConnectionsHeight: 200,
      sashimiArcsHeight: 100,
      hasArcs: false,
    }),
  ).toEqual({
    coverageHeight: 45,
    hasArcsBand: false,
    hasSashimiBand: false,
    arcsBandTop: 45,
    sashimiBandTop: 45,
    bottom: 45,
  })
})

test('arc band then sashimi band stack below coverage', () => {
  expect(
    belowCoverageBandsGeometry({
      ...baseBands,
      readConnections: 'arc',
      readConnectionsDown: true,
      readConnectionsHeight: 200,
      showSashimiArcs: true,
      sashimiArcsHeight: 100,
      hasSashimiDownArcs: true,
    }),
  ).toEqual({
    coverageHeight: 45,
    hasArcsBand: true,
    hasSashimiBand: true,
    arcsBandTop: 45,
    sashimiBandTop: 245,
    bottom: 345,
  })
})

test('down-mode arcs reserve a band per section, pushing pileups down', () => {
  const { sections, contentHeight } = computeStackedSections(
    [lane({ key: 'a', maxY: 2 }), lane({ key: 'b', maxY: 3 })],
    {
      coverageHeight: 40,
      rowHeight: 10,
      readConnections: 'arc',
      readConnectionsDown: true,
      readConnectionsHeight: 100,
    },
  )
  // Each section: coverage 40 + arc band 100, then pileup.
  expect(
    sections.map(s => [s.coverageTop, s.arcBandTop, s.pileupTop, s.maxY]),
  ).toEqual([
    [0, 40, 140, 2],
    [160, 200, 300, 3],
  ])
  expect(sections.every(s => s.arcBandHeight === 100)).toBe(true)
  expect(contentHeight).toBe(330)
})

test('an arc-less lane reserves no arc band, so the ones with arcs shift up', () => {
  const { sections, contentHeight } = computeStackedSections(
    [
      lane({ key: 'notsplit', label: 'Not split', maxY: 2, hasArcs: false }),
      lane({ key: 'split', label: 'Split (SA)', maxY: 3 }),
    ],
    {
      coverageHeight: 40,
      rowHeight: 10,
      readConnections: 'arc',
      readConnectionsDown: true,
      readConnectionsHeight: 100,
    },
  )
  // Lane 1 has no arcs: pileup right under its coverage (40), bottom 60. Lane 2
  // still reserves its 100px band, so 100px of dead strip is gone from the stack.
  expect(sections.map(s => [s.coverageTop, s.pileupTop])).toEqual([
    [0, 40],
    [60, 200],
  ])
  expect(sections.map(s => s.arcBandHeight)).toEqual([0, 100])
  expect(contentHeight).toBe(230)
})

test('an arc-less lane drops its up-mode draw band too', () => {
  const { sections } = computeStackedSections(
    [lane({ key: 'a', maxY: 2, hasArcs: false }), lane({ key: 'b', maxY: 2 })],
    {
      coverageHeight: 40,
      rowHeight: 10,
      coverageYOffset: 7,
      readConnections: 'arc',
      readConnectionsDown: false,
      readConnectionsHeight: 100,
    },
  )
  // Up mode reserves nothing either way, so only the draw band differs.
  expect(sections.map(s => s.pileupTop)).toEqual([40, 100])
  expect(sections.map(s => s.arcBandHeight)).toEqual([0, 33])
})

test('the sashimi strip is reserved per lane too', () => {
  const { sections } = computeStackedSections(
    [
      lane({ key: 'a', maxY: 2, hasArcs: false }),
      lane({ key: 'b', maxY: 2, hasArcs: false, hasSashimiDownArcs: true }),
    ],
    {
      coverageHeight: 40,
      rowHeight: 10,
      showSashimiArcs: true,
      sashimiHeight: 30,
    },
  )
  // Lane a: coverage 40, pileup 40..60. Lane b starts at 60 and is the only one
  // paying the 30px strip, so its pileup starts at 60 + 40 + 30.
  expect(sections.map(s => [s.pileupTop, s.hasSashimiBand])).toEqual([
    [40, false],
    [130, true],
  ])
})

test('both strips stack for a lane that has arcs and sashimi', () => {
  const { sections } = computeStackedSections(
    [lane({ key: 'a', maxY: 2, hasSashimiDownArcs: true })],
    {
      coverageHeight: 40,
      rowHeight: 10,
      readConnections: 'arc',
      readConnectionsDown: true,
      readConnectionsHeight: 100,
      showSashimiArcs: true,
      sashimiHeight: 30,
    },
  )
  expect(sections[0]).toMatchObject({
    arcBandTop: 40,
    sashimiBandTop: 140,
    pileupTop: 170,
    hasArcsBand: true,
    hasSashimiBand: true,
  })
})

test('the sashimi strip needs the coverage band it hangs off', () => {
  const { sections } = computeStackedSections(
    [lane({ key: 'a', maxY: 2, hasArcs: false, hasSashimiDownArcs: true })],
    {
      coverageHeight: 40,
      showCoverage: false,
      rowHeight: 10,
      showSashimiArcs: true,
      sashimiHeight: 30,
    },
  )
  expect(sections[0]).toMatchObject({ pileupTop: 0, hasSashimiBand: false })
})

test('up-mode arcs overlay coverage: no reserved band, draw band at coverage top', () => {
  const { sections } = computeStackedSections(
    [lane({ key: 'a', maxY: 2 }), lane({ key: 'b', maxY: 2 })],
    {
      coverageHeight: 40,
      rowHeight: 10,
      coverageYOffset: 7,
      readConnections: 'arc',
      readConnectionsDown: false,
      readConnectionsHeight: 100,
    },
  )
  // No reserved arc band: pileup sits right under coverage (40), section 2
  // starts at 40 + 20 = 60. Arc draw band overlays the coverage band.
  expect(sections.map(s => [s.coverageTop, s.pileupTop])).toEqual([
    [0, 40],
    [60, 100],
  ])
  expect(sections[0]).toMatchObject({ arcBandTop: 0, arcBandHeight: 33 })
  expect(sections[1]).toMatchObject({ arcBandTop: 60, arcBandHeight: 33 })
})

test('single section stacks coverage then pileup from the top', () => {
  const { sections, contentHeight } = computeStackedSections(
    [lane({ key: '', maxY: 4 })],
    { coverageHeight: 45, rowHeight: 10 },
  )
  expect(sections).toHaveLength(1)
  expect(sections[0]).toMatchObject({
    coverageTop: 0,
    coverageHeight: 45,
    pileupTop: 45,
    pileupHeight: 40,
  })
  expect(contentHeight).toBe(85)
})

test('multiple sections stack with each coverage above its own pileup', () => {
  const { sections, contentHeight } = computeStackedSections(
    [
      lane({ key: '1', label: 'HP: 1', maxY: 3 }),
      lane({ key: '2', label: 'HP: 2', maxY: 5 }),
    ],
    { coverageHeight: 20, rowHeight: 10 },
  )
  expect(
    sections.map(s => [s.coverageTop, s.pileupTop, s.pileupHeight]),
  ).toEqual([
    [0, 20, 30],
    [50, 70, 50],
  ])
  // arc/sashimi bands pinned to 0 in grouped mode
  expect(sections.every(s => s.arcBandHeight === 0)).toBe(true)
  expect(contentHeight).toBe(120)
})

test('coverageHeight 0 (coverage hidden) collapses each section to its pileup', () => {
  const { sections } = computeStackedSections(
    [lane({ key: 'a', maxY: 2 }), lane({ key: 'b', maxY: 2 })],
    { coverageHeight: 0, rowHeight: 10 },
  )
  expect(sections[0]!.pileupTop).toBe(0)
  expect(sections[1]!.pileupTop).toBe(20)
})

// One-section layout (groupKey '') with a coverage band of 45 and 4 pileup rows.
const ungrouped: SectionsLayout = computeStackedSections(
  [lane({ key: '', maxY: 4 })],
  { coverageHeight: 45, rowHeight: 10 },
)

const grouped: SectionsLayout = computeStackedSections(
  [
    lane({ key: '1', label: 'HP: 1', maxY: 3 }),
    lane({ key: '2', label: 'HP: 2', maxY: 5 }),
  ],
  { coverageHeight: 20, rowHeight: 10 },
)

test('buildSectionRenders: ungrouped keeps coverage sticky and pileup full-bleed', () => {
  // scrollTop must NOT move the ungrouped coverage band (sticky) or its clips.
  const renders = buildSectionRenders(ungrouped, {
    scrollTop: 37,
    canvasHeight: 600,
  })
  expect(renders).toEqual([
    {
      pileupTopOffset: 45,
      coverageTopOffset: 0,
      covClipTop: 0,
      covClipHeight: 600,
      pileupClipTop: 45,
      pileupClipHeight: 555,
    },
  ])
})

test('buildSectionRenders: grouped scrolls each whole section band by scrollTop', () => {
  const renders = buildSectionRenders(grouped, {
    scrollTop: 10,
    canvasHeight: 600,
  })
  // Section tops from `grouped`: cov 0/pileup 20 (h30), cov 50/pileup 70 (h50).
  expect(renders).toEqual([
    {
      pileupTopOffset: 20,
      coverageTopOffset: -10,
      covClipTop: -10,
      covClipHeight: 20,
      pileupClipTop: 10,
      pileupClipHeight: 30,
    },
    {
      pileupTopOffset: 70,
      coverageTopOffset: 40,
      covClipTop: 40,
      covClipHeight: 20,
      pileupClipTop: 60,
      pileupClipHeight: 50,
    },
  ])
})

test('buildSectionRenders: grouped pileupTopOffset is content-space (scroll via shader)', () => {
  // The pileup top offset is NOT pre-scrolled — the shader subtracts scrollTop
  // (rangeY0). Only the coverage band and clip bands carry the scroll.
  const a = buildSectionRenders(grouped, { scrollTop: 0, canvasHeight: 600 })
  const b = buildSectionRenders(grouped, { scrollTop: 100, canvasHeight: 600 })
  expect(a.map(s => s.pileupTopOffset)).toEqual(b.map(s => s.pileupTopOffset))
})

// Down-mode arc layouts for the arcBand screen-geometry tests.
const ungroupedArcs: SectionsLayout = computeStackedSections(
  [lane({ key: '', maxY: 4 })],
  {
    coverageHeight: 40,
    rowHeight: 10,
    readConnections: 'arc',
    readConnectionsDown: true,
    readConnectionsHeight: 100,
  },
)

const groupedArcs: SectionsLayout = computeStackedSections(
  [lane({ key: 'a', maxY: 2 }), lane({ key: 'b', maxY: 3 })],
  {
    coverageHeight: 40,
    rowHeight: 10,
    readConnections: 'arc',
    readConnectionsDown: true,
    readConnectionsHeight: 100,
  },
)

test('buildSectionRenders: ungrouped arc band is sticky (scroll does not move it)', () => {
  // Coverage + arc band are sticky in ungrouped mode, so the band keeps its
  // content-space top (40 = below the 40px coverage) regardless of scroll.
  const a = buildSectionRenders(ungroupedArcs, { scrollTop: 0, canvasHeight: 600 }) // prettier-ignore
  const b = buildSectionRenders(ungroupedArcs, { scrollTop: 250, canvasHeight: 600 }) // prettier-ignore
  expect(a[0]!.arcBand).toEqual({ top: 40, height: 100, down: true })
  expect(b[0]!.arcBand).toEqual({ top: 40, height: 100, down: true })
})

test('buildSectionRenders: grouped arc band scrolls with its section', () => {
  // Section a: cov 0, arc 40, pileup 140 (+20 rows) => bottom 160.
  // Section b: cov 160, arc 200. Each arc band shifts up by scrollTop, the same
  // as its coverage band.
  const renders = buildSectionRenders(groupedArcs, {
    scrollTop: 30,
    canvasHeight: 600,
  })
  expect(renders[0]!.arcBand).toEqual({ top: 10, height: 100, down: true })
  expect(renders[1]!.arcBand).toEqual({ top: 170, height: 100, down: true })
})

test('buildSectionRenders: no arc band reserved => arcBand undefined', () => {
  expect(
    buildSectionRenders(grouped, { scrollTop: 0, canvasHeight: 600 })[0]!
      .arcBand,
  ).toBeUndefined()
})

// One-row-per-group layouts make sections shorter than their own label chips,
// which are anchored at each section's top. Without a floor the chips stack on
// top of each other and every label but the last is unreadable.
test('minSectionHeight floors the advance to the next section, not the pileup', () => {
  const { sections, contentHeight } = computeStackedSections(
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

test('minSectionHeight is inert once a section is taller than it', () => {
  const tall = [lane({ key: 'a', maxY: 4 }), lane({ key: 'b', maxY: 4 })]
  const opts = { coverageHeight: 0, showCoverage: false, rowHeight: 8 }
  expect(
    computeStackedSections(tall, { ...opts, minSectionHeight: 16 }),
  ).toEqual(computeStackedSections(tall, opts))
})
