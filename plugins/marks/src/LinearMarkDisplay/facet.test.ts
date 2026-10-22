import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { HIDDEN_ROW, RowKeys, rowSlot } from '@jbrowse/render-core/marks'

import { facetLayout, unsplitRegion } from './facet.ts'
import {
  drawnKeysOf,
  drawnRegion,
  facetRowName,
  facetRowTable,
  keyRegion,
} from './rowTable.ts'

import type { FacetLayout } from './facet.ts'
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

// Each instance's slot through the facet's table, undefined where it hides.
function slotsOf(regions: MarkRegionData[], layout: FacetLayout) {
  const rowKeys = new RowKeys()
  const keyed = regions.map(r => keyRegion(r, rowKeys, 'grp', facetRowName))
  const table = facetRowTable(rowKeys.names.slice(), layout)
  return {
    keyed,
    rowKeys,
    table,
    slots: keyed.map(r =>
      r.layers.map(l =>
        Array.from({ length: l.count }, (_, i) => rowSlot(l.row, i, table)),
      ),
    ),
  }
}

function twoSections(layer: StoredLayer): MarkRegionData {
  return {
    layers: [layer],
    facet: [
      { key: 'a', firstRow: 0, rowCount: 1 },
      { key: 'b', firstRow: 1, rowCount: 1 },
    ],
  }
}

test("a hidden section's rows hide through the table, and leave the key and extents", () => {
  const region = twoSections(linkLayer())
  const layout = facetLayout(
    [region],
    categoricalField('grp'),
    new Set(['a']),
    [true],
  )
  const { keyed, rowKeys, table, slots } = slotsOf([region], layout)
  expect(slots[0]![0]).toEqual([undefined, undefined, 0, 0])
  const drawn = drawnKeysOf(table, keyed, rowKeys, 'grp', facetRowName)!
  expect(drawnRegion(keyed[0]!, drawn).layers[0]!.sizeScale!.extent).toEqual([
    3, 4,
  ])
})

test('every section shown hides nothing, so the legend reads the region whole', () => {
  const region = twoSections(linkLayer())
  const layout = facetLayout([region], categoricalField('grp'), new Set(), [
    true,
  ])
  const { keyed, rowKeys, table, slots } = slotsOf([region], layout)
  expect(slots[0]![0]).toEqual([0, 0, 1, 1])
  expect(
    drawnKeysOf(table, keyed, rowKeys, 'grp', facetRowName),
  ).toBeUndefined()
})

// The layout follows the deepest region, and a region already keyed keeps its
// lanes: only the table moves.
test('a deeper region moves the sections below it through the table alone', () => {
  const shallow: MarkRegionData = {
    layers: [linkLayer()],
    facet: [
      { key: 'a', firstRow: 0, rowCount: 1 },
      { key: 'b', firstRow: 1, rowCount: 1 },
    ],
  }
  const deep: MarkRegionData = {
    layers: [barLayer([0, 1, 2, 3])],
    facet: [
      { key: 'a', firstRow: 0, rowCount: 3 },
      { key: 'b', firstRow: 3, rowCount: 1 },
    ],
  }
  const field = categoricalField('grp')
  const rowKeys = new RowKeys()
  const keyedShallow = keyRegion(shallow, rowKeys, 'grp', facetRowName)
  const before = facetRowTable(
    rowKeys.names.slice(),
    facetLayout([shallow], field, new Set(), [true]),
  )
  const keyedDeep = keyRegion(deep, rowKeys, 'grp', facetRowName)
  const after = facetRowTable(
    rowKeys.names.slice(),
    facetLayout([shallow, deep], field, new Set(), [true]),
  )
  const slots = (r: MarkRegionData, table: typeof before) =>
    Array.from({ length: r.layers[0]!.count }, (_, i) =>
      rowSlot(r.layers[0]!.row, i, table),
    )
  expect(slots(keyedShallow, before)).toEqual([0, 0, 1, 1])
  expect(slots(keyedShallow, after)).toEqual([0, 0, 3, 3])
  expect(slots(keyedDeep, after)).toEqual([0, 1, 2, 3])
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
  const rowKeys = new RowKeys()
  const keyed = (r: MarkRegionData) => [
    ...keyRegion(r, rowKeys, 'strand', facetRowName).layers[0]!.row!,
  ]
  expect(keyed(stale)).toEqual([HIDDEN_ROW, HIDDEN_ROW, HIDDEN_ROW, HIDDEN_ROW])
  expect(keyed(fresh)).not.toContain(HIDDEN_ROW)
})

test('a region fetched before the facet draws nothing', () => {
  const unsplit: MarkRegionData = {
    layers: [linkLayer()],
    request: { ...splitOn('strand')!, facet: undefined },
  }
  expect([
    ...keyRegion(unsplit, new RowKeys(), 'strand', facetRowName).layers[0]!
      .row!,
  ]).toEqual([HIDDEN_ROW, HIDDEN_ROW, HIDDEN_ROW, HIDDEN_ROW])
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
  const [slots] = slotsOf([region], zoomedOut).slots
  expect(slots![1]).toEqual([0, 1])
  expect(slots![0]).toEqual([0, undefined, undefined, undefined, 1, undefined])
  const zoomedIn = facetLayout([region], field, new Set(), [true, true])
  expect(zoomedIn.rowCount).toBe(6)
})

test('a region first laid out under another field gets its rows under its own', () => {
  const region: MarkRegionData = {
    layers: [barLayer([0, 1, 2])],
    facet: [
      { key: 'a', firstRow: 0, rowCount: 2 },
      { key: 'b', firstRow: 2, rowCount: 1 },
    ],
    request: splitOn('grp'),
  }
  const lay = (field: string) =>
    facetLayout([region], categoricalField(field), new Set(), [true]).rowCount
  expect(lay('other')).toBe(0)
  expect(lay('grp')).toBe(3)
})
