import { categoricalField } from '@jbrowse/core/util/categoricalField'

import { facetLayout, facetRegion, unsplitRegion } from './facet.ts'

import type { MarkRegionData, StoredLayer } from './markList.ts'

function linkLayer(): StoredLayer {
  return {
    count: 4,
    skipped: 0,
    x: Uint32Array.from([10, 20, 30, 40]),
    x2: Uint32Array.from([11, 21, 31, 41]),
    featureIndex: Uint32Array.from([0, 1, 2, 3]),
    row: Uint32Array.from([0, 0, 1, 1]),
    color: Uint32Array.from([1, 2, 3, 4]),
    size: Float32Array.from([1, 2, 3, 4]),
    x2Ref: Uint32Array.from([0, 0, 1, 1]),
    x2RefNames: ['chr1', 'chr2'],
    sizeScale: {
      field: 'score',
      scale: 'linear',
      domain: [1, 4],
      pinned: [false, false],
      range: [1, 6],
      extent: [1, 4],
    },
    yMin: Infinity,
    yMax: -Infinity,
  }
}

function hideFirstSection(layer: StoredLayer) {
  const region: MarkRegionData = {
    layers: [layer],
    facet: [
      { key: 'a', firstRow: 0, rowCount: 1 },
      { key: 'b', firstRow: 1, rowCount: 1 },
    ],
  }
  const layout = facetLayout(
    [region],
    categoricalField('grp'),
    new Set(['a']),
    [true],
  )
  return facetRegion(region, layout).layers[0]!
}

test('a hidden section leaves every lane, size and x2Ref included', () => {
  const out = hideFirstSection(linkLayer())
  expect(out.count).toBe(2)
  expect([...out.x]).toEqual([30, 40])
  expect([...(out.color as Uint32Array)]).toEqual([3, 4])
  expect([...out.size!]).toEqual([3, 4])
  expect([...out.x2Ref!]).toEqual([1, 1])
})

test('a hidden section keeps a constant colour as one number', () => {
  const out = hideFirstSection({ ...linkLayer(), color: 0xff0000ff })
  expect(out.count).toBe(2)
  expect(out.color).toBe(0xff0000ff)
})

test('a hidden section leaves the size scale it widened', () => {
  expect(hideFirstSection(linkLayer()).sizeScale!.extent).toEqual([3, 4])
})

function splitOn(field: string): MarkRegionData['request'] {
  return {
    region: { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
    layers: [],
    facet: { field },
  } as unknown as MarkRegionData['request']
}

// A facet field change refetches each region on its own, so one region can
// land under the new field while another still holds the old field's sections.
test('a region split on the outgoing field draws nothing, though its keys match the new field', () => {
  const stale: MarkRegionData = {
    layers: [linkLayer()],
    facet: [
      { key: '0', firstRow: 0, rowCount: 1 },
      { key: '1', firstRow: 1, rowCount: 1 },
    ],
    request: splitOn('nm'),
  }
  const fresh: MarkRegionData = {
    layers: [linkLayer()],
    facet: [
      { key: '-1', firstRow: 0, rowCount: 1 },
      { key: '1', firstRow: 1, rowCount: 1 },
    ],
    request: splitOn('strand'),
  }
  const layout = facetLayout(
    [stale, fresh],
    categoricalField('strand'),
    new Set(),
    [true],
  )
  expect(facetRegion(stale, layout).layers[0]!.count).toBe(0)
  expect(facetRegion(fresh, layout).layers[0]!.count).toBe(4)
})

test('a region fetched before the facet draws nothing, and the density sidecar keeps its rows', () => {
  const layout = facetLayout([], categoricalField('strand'), new Set(), [])
  const unsplit: MarkRegionData = {
    layers: [linkLayer()],
    request: { ...splitOn('strand')!, facet: undefined },
  }
  expect(facetRegion(unsplit, layout).layers[0]!.count).toBe(0)
  const sidecar: MarkRegionData = { layers: [linkLayer()] }
  expect(facetRegion(sidecar, layout)).toBe(sidecar)
})

test('with no split, a region fetched under one draws nothing, and an unsplit one draws as it came', () => {
  const split: MarkRegionData = {
    layers: [linkLayer()],
    facet: [{ key: '1', firstRow: 0, rowCount: 2 }],
    request: splitOn('strand'),
  }
  expect(unsplitRegion(split).layers[0]!.count).toBe(0)
  const unsplit: MarkRegionData = {
    layers: [linkLayer()],
    request: { ...splitOn('strand')!, facet: undefined },
  }
  expect(unsplitRegion(unsplit)).toBe(unsplit)
  const sidecar: MarkRegionData = { layers: [linkLayer()] }
  expect(unsplitRegion(sidecar)).toBe(sidecar)
})

function barLayer(rows: number[]): StoredLayer {
  return {
    count: rows.length,
    skipped: 0,
    x: Uint32Array.from(rows, (_, i) => i * 10),
    x2: Uint32Array.from(rows, (_, i) => i * 10 + 5),
    y: Float32Array.from(rows, () => 1),
    row: Uint32Array.from(rows),
    color: 0xff0000ff,
    yMin: 1,
    yMax: 1,
  }
}

// A per-section pileup zoomed in and a density zoomed out: the worker packs
// both, so each section is as deep as its pileup, but zoomed out only the
// density's one row a section is drawn.
test('a section is as deep as the layers drawn at this zoom stand in it', () => {
  const region: MarkRegionData = {
    layers: [barLayer([0, 1, 2, 3, 4, 5]), barLayer([0, 4])],
    facet: [
      { key: 'a', firstRow: 0, rowCount: 4 },
      { key: 'b', firstRow: 4, rowCount: 2 },
    ],
  }
  const field = categoricalField('grp')
  const zoomedOut = facetLayout([region], field, new Set(), [false, true])
  expect(zoomedOut.sections.map(s => [s.firstRow, s.rowCount])).toEqual([
    [0, 1],
    [1, 1],
  ])
  const drawn = facetRegion(region, zoomedOut).layers
  expect([...drawn[1]!.row!]).toEqual([0, 1])
  expect([...drawn[0]!.row!]).toEqual([0, 1])
  const zoomedIn = facetLayout([region], field, new Set(), [true, true])
  expect(zoomedIn.rowCount).toBe(6)
})
