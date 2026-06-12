import { sectionRegionKey } from './renderers/rendererTypes.ts'
import {
  buildSectionRenders,
  computeBandStack,
  computeStackedSections,
} from './sectionLayout.ts'

import type { SectionsLayout } from './sectionLayout.ts'

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

test('computeBandStack: no read-connection bands = pileup right below coverage', () => {
  expect(
    computeBandStack({
      coverageHeight: 45,
      hasArcsBand: false,
      arcsHeight: 200,
      hasSashimiBand: false,
      sashimiHeight: 100,
    }),
  ).toEqual({ arcsBandTop: 45, sashimiBandTop: 45, pileupTop: 45 })
})

test('computeBandStack: arc band then sashimi band stack below coverage', () => {
  expect(
    computeBandStack({
      coverageHeight: 45,
      hasArcsBand: true,
      arcsHeight: 200,
      hasSashimiBand: true,
      sashimiHeight: 100,
    }),
  ).toEqual({ arcsBandTop: 45, sashimiBandTop: 245, pileupTop: 345 })
})

test('down-mode arcs reserve a band per section, pushing pileups down', () => {
  const { sections, contentHeight } = computeStackedSections(
    [
      { key: 'a', label: 'a', maxY: 2 },
      { key: 'b', label: 'b', maxY: 3 },
    ],
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

test('up-mode arcs overlay coverage: no reserved band, draw band at coverage top', () => {
  const { sections } = computeStackedSections(
    [
      { key: 'a', label: 'a', maxY: 2 },
      { key: 'b', label: 'b', maxY: 2 },
    ],
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
    [{ key: '', label: '', maxY: 4 }],
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
      { key: '1', label: 'HP: 1', maxY: 3 },
      { key: '2', label: 'HP: 2', maxY: 5 },
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
    [
      { key: 'a', label: 'a', maxY: 2 },
      { key: 'b', label: 'b', maxY: 2 },
    ],
    { coverageHeight: 0, rowHeight: 10 },
  )
  expect(sections[0]!.pileupTop).toBe(0)
  expect(sections[1]!.pileupTop).toBe(20)
})

// One-section layout (groupKey '') with a coverage band of 45 and 4 pileup rows.
const ungrouped: SectionsLayout = computeStackedSections(
  [{ key: '', label: '', maxY: 4 }],
  { coverageHeight: 45, rowHeight: 10 },
)

const grouped: SectionsLayout = computeStackedSections(
  [
    { key: '1', label: 'HP: 1', maxY: 3 },
    { key: '2', label: 'HP: 2', maxY: 5 },
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
  [{ key: '', label: '', maxY: 4 }],
  {
    coverageHeight: 40,
    rowHeight: 10,
    readConnections: 'arc',
    readConnectionsDown: true,
    readConnectionsHeight: 100,
  },
)

const groupedArcs: SectionsLayout = computeStackedSections(
  [
    { key: 'a', label: 'a', maxY: 2 },
    { key: 'b', label: 'b', maxY: 3 },
  ],
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
