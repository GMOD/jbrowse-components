import { categoricalField } from '@jbrowse/core/util/categoricalField'

import { facetLayout, facetRegion } from './facet.ts'

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
  const layout = facetLayout([region], categoricalField('grp'), new Set(['a']))
  return facetRegion(region, layout).layers[0]!
}

test('a hidden section leaves every lane, size and x2Ref included', () => {
  const out = hideFirstSection(linkLayer())
  expect(out.count).toBe(2)
  expect([...out.x]).toEqual([30, 40])
  expect([...out.color!]).toEqual([3, 4])
  expect([...out.size!]).toEqual([3, 4])
  expect([...out.x2Ref!]).toEqual([1, 1])
})

test('a hidden section leaves the size scale it widened', () => {
  expect(hideFirstSection(linkLayer()).sizeScale!.extent).toEqual([3, 4])
})
