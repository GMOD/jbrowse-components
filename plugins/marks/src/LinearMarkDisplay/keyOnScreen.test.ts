import { NO_VALUE_ABGR } from '@jbrowse/core/util/markEncoding'
import { SHAPE_CODES } from '@jbrowse/core/util/shapeNames'
import { keyWindowsOf } from '@jbrowse/display-kit/keyWindows'
import { LINK_ELSEWHERE, LINK_NO_REGION } from '@jbrowse/render-core/marks'

import { regionsKeyOnScreen } from './keyOnScreen.ts'

import type { MarkRegionData, StoredLayer } from './markList.ts'

const RED = 0xff0000ff
const GREEN = 0xff00ff00
const BLUE = 0xffff0000

// region 0 shows chr1:1000-2000, region 1 chr2:0-500
const windows = keyWindowsOf([
  { displayedRegionIndex: 0, refName: 'chr1', start: 1000, end: 2000 },
  { displayedRegionIndex: 1, refName: 'chr2', start: 0, end: 500 },
])

function layer(
  spans: [number, number][],
  colors: number[],
  extra: Partial<StoredLayer> = {},
): StoredLayer {
  return {
    count: spans.length,
    skipped: 0,
    yMin: 0,
    yMax: 0,
    x: Uint32Array.from(spans, s => s[0]),
    x2: Uint32Array.from(spans, s => s[1]),
    color: Uint32Array.from(colors),
    scale: {
      kind: 'categorical',
      field: 'type',
      domain: [],
      entries: [
        { value: 'gene', color: RED },
        { value: 'exon', color: GREEN },
        { value: 'CDS', color: BLUE },
      ],
    },
    ...extra,
  }
}

function keyed(regions: Map<number, MarkRegionData>) {
  return regionsKeyOnScreen(regions, windows).flatMap(r =>
    r.layers.flatMap(l =>
      l.scale?.kind === 'categorical' ? l.scale.entries.map(e => e.value) : [],
    ),
  )
}

test('a category painted only in the fetch buffer keys nothing', () => {
  const data = layer(
    [
      [1500, 1600],
      [200, 300],
      [900, 1100],
    ],
    [RED, GREEN, BLUE],
  )
  expect(keyed(new Map([[0, { layers: [data] }]]))).toEqual(['gene', 'CDS'])
})

test('a region with no window keys nothing', () => {
  const data = layer([[1500, 1600]], [RED])
  expect(keyed(new Map([[2, { layers: [data] }]]))).toEqual([])
})

test('a hidden entry stays, the key being its way back', () => {
  const data = layer([[1500, 1600]], [RED])
  const scale = data.scale!
  const hidden = {
    ...data,
    scale:
      scale.kind === 'categorical'
        ? {
            ...scale,
            entries: [
              ...scale.entries,
              { value: 'UTR', color: 0, hidden: true },
            ],
          }
        : scale,
  }
  expect(keyed(new Map([[0, { layers: [hidden] }]]))).toEqual(['gene', 'UTR'])
})

test('a link keys by its dome on one region and by either foot across two', () => {
  const data = layer(
    [
      [100, 3000],
      [100, 300],
      [100, 4000],
      [1500, 300],
    ],
    [RED, GREEN, BLUE, BLUE],
    { x2Region: Uint32Array.from([0, 1, LINK_NO_REGION, LINK_ELSEWHERE]) },
  )
  expect(keyed(new Map([[0, { layers: [data] }]]))).toEqual(['gene', 'exon'])
})

test("a shape's entries key by the glyph drawn on screen", () => {
  const data = layer(
    [
      [1500, 1600],
      [100, 200],
    ],
    [RED, RED],
    {
      glyph: Uint8Array.from([SHAPE_CODES.diamond, SHAPE_CODES.square]),
      shapeScale: {
        kind: 'shape',
        field: 'strand',
        domain: [],
        entries: [
          { value: '1', shape: 'diamond' },
          { value: '-1', shape: 'square' },
        ],
      },
    },
  )
  const [region] = regionsKeyOnScreen(
    new Map([[0, { layers: [data] }]]),
    windows,
  )
  expect(region!.layers[0]!.shapeScale!.entries.map(e => e.value)).toEqual([
    '1',
  ])
})

test('a ramp keeps its extent, and its no-value row only where it shows', () => {
  const ramp = {
    kind: 'ramp' as const,
    field: 'score',
    scale: 'linear' as const,
    domain: [0, 10] as [number, number],
    pinned: [false, false] as [boolean, boolean],
    extent: [0, 10] as [number, number],
    lut: new Uint8Array(0),
    missing: true,
  }
  const data = layer(
    [
      [1500, 1600],
      [100, 200],
    ],
    [RED, NO_VALUE_ABGR],
    {
      scale: ramp,
    },
  )
  const [region] = regionsKeyOnScreen(
    new Map([[0, { layers: [data] }]]),
    windows,
  )
  expect(region!.layers[0]!.scale).toEqual({ ...ramp, missing: false })
})
