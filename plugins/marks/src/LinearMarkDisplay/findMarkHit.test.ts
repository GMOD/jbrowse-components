import { hitIndexOf } from '@jbrowse/core/util/markEncoding'
import {
  HIDDEN_ROW,
  backToFront,
  buildRowTable,
  nearestMarkHit,
  pointInsetPx,
} from '@jbrowse/render-core/marks'

import { densityRegionData } from './densityLayer.ts'
import { facetLayout, facetRegion } from './facet.ts'
import { findMarkHit } from './findMarkHit.ts'
import { buildMarkList } from './markList.ts'

import type { MarkHitInfo } from './findMarkHit.ts'
import type {
  DisplayMark,
  MarkEntry,
  MarkRegionData,
  MarkRenderState,
  StoredLayer,
} from './markList.ts'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function entries(...types: MarkEntry['type'][]): MarkEntry[] {
  return types.map(type => ({
    type,
    minBpPerPx: 0,
    maxBpPerPx: 0,
    placed: true,
    valued: true,
    linkShape: 'dome',
  }))
}

const STATE: MarkRenderState = {
  domainY: [0, 10],
  scaleTypeY: 'linear',
  symlogConstantY: 1,
  colorScales: [],
  canvasWidth: 800,
  canvasHeight: 360,
  bpPerPx: 1.25,
  origin: 0,
  // a bar floored at a width past its bp puts ink neither lookup reaches
  minWidthPx: 0,
  markSizes: [3, 3, 3],
  sizeScales: [],
  linkRegions: [],
  valueInsetPx: pointInsetPx(3),
  rowHeight: 30,
  rowProportions: [1, 1, 1],
  scrollTop: 0,
}

const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 800,
  reversed: false,
}

const REGIONS = [{ refName: 'ctgA' }]

// Bars dealt across `rows` in no order: most short, a few long, some written
// end first, some out of the domain either way, some at the origin.
function randomLayer(seed: number, n: number, rows: number): StoredLayer {
  const rand = lcg(seed)
  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const y = new Float32Array(n)
  const row = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const start = Math.floor(rand() * 1000)
    const length =
      rand() < 0.03 ? Math.floor(rand() * 300) : 1 + Math.floor(rand() * 20)
    const flip = rand() < 0.05
    x[i] = flip ? start + length : start
    x2[i] = flip ? start : start + length
    y[i] = rand() < 0.05 ? 0 : -3 + rand() * 16
    row[i] = Math.floor(rand() * rows)
  }
  return {
    count: n,
    skipped: 0,
    x,
    x2,
    y,
    row,
    color: new Uint32Array(n).fill(0xff0000ff),
    yMin: -3,
    yMax: 13,
  }
}

function withFlatbush(data: MarkRegionData): MarkRegionData {
  return {
    ...data,
    layers: data.layers.map(l => ({
      ...l,
      flatbush: l.count > 0 ? hitIndexOf(l.x, l.x2, l.y, l.count) : undefined,
    })),
  }
}

function byIndex(marks: DisplayMark[]): DisplayMark[] {
  return marks.map(m => ({ ...m, hitBy: 'index' }))
}

// Every instance asked, back to front, with no window to prune any: where the
// ink says the nearest is.
function nearestInkOf(
  marks: DisplayMark[],
  data: MarkRegionData,
  state: MarkRenderState,
  block: RenderBlock,
  x: number,
  y: number,
) {
  const hit = nearestMarkHit(marks, [block], () => data, state, x, y, {
    radiusPx: 8,
    candidates: (d, m) => backToFront(0, d.layers[marks[m]!.markIndex]!.count),
  })
  return hit && { markIndex: marks[hit.mark]!.markIndex, instance: hit.index }
}

// The hit each way at random hovers — by rows, through the Flatbush over the
// same lanes, and, where `truth`, over every instance — the same.
function parity(
  types: MarkEntry['type'][],
  data: MarkRegionData,
  state: MarkRenderState,
  { block = BLOCK, probes = 4000, truth = true } = {},
) {
  expect(data.layers.every(l => l.flatbush === undefined)).toBe(true)
  const marks = buildMarkList(entries(...types))
  const byRows = new Map([[0, data]])
  const indexed = new Map([[0, withFlatbush(data)]])
  const rand = lcg(11)
  const differ: [number, number, MarkHitInfo?, MarkHitInfo?][] = []
  let hits = 0
  for (let k = 0; k < probes; k++) {
    const x = rand() * state.canvasWidth
    const y = rand() * state.canvasHeight
    const got = findMarkHit(x, y, [block], byRows, marks, state, REGIONS)
    const want = findMarkHit(
      x,
      y,
      [block],
      indexed,
      byIndex(marks),
      state,
      REGIONS,
    )
    const ink = truth ? nearestInkOf(marks, data, state, block, x, y) : got
    if (
      JSON.stringify(got) !== JSON.stringify(want) ||
      got?.instance !== ink?.instance ||
      got?.markIndex !== ink?.markIndex
    ) {
      differ.push([x, y, got, want])
    }
    hits += got ? 1 : 0
  }
  expect(differ.slice(0, 3)).toEqual([])
  return { hits, probes }
}

test('a bar by its row answers what the Flatbush answers', () => {
  const layer = randomLayer(1, 1500, 12)
  const { hits, probes } = parity(['bar'], { layers: [layer] }, STATE)
  expect(hits).toBeGreaterThan(probes / 4)
})

test('of two bars under the cursor, the one drawn over the other answers', () => {
  const layer: StoredLayer = {
    count: 3,
    skipped: 0,
    x: Uint32Array.from([100, 90, 95]),
    x2: Uint32Array.from([140, 150, 145]),
    y: Float32Array.from([5, 6, 7]),
    color: new Uint32Array(3).fill(0xff0000ff),
    yMin: 5,
    yMax: 7,
  }
  const state = { ...STATE, rowHeight: STATE.canvasHeight }
  const marks = buildMarkList(entries('bar'))
  const data = new Map([[0, { layers: [layer] }]])
  const hit = findMarkHit(96, 300, [BLOCK], data, marks, state, REGIONS)
  expect(hit?.instance).toBe(2)
})

test('a bar with no row lane, the whole canvas its band, answers the same', () => {
  const { row: _row, ...layer } = randomLayer(2, 800, 1)
  const state = { ...STATE, rowHeight: STATE.canvasHeight }
  const { hits, probes } = parity(['bar'], { layers: [layer] }, state)
  expect(hits).toBeGreaterThan(probes / 4)
})

test('a bar hanging from a baseline mid-band answers the same from either side of it', () => {
  const { row: _row, ...layer } = randomLayer(9, 800, 1)
  const state: MarkRenderState = {
    ...STATE,
    domainY: [-8, 8],
    rowHeight: STATE.canvasHeight,
  }
  const { hits, probes } = parity(['bar'], { layers: [layer] }, state)
  expect(hits).toBeGreaterThan(probes / 4)
})

test('a thick rule answers the same from past its value', () => {
  const { row: _row, ...layer } = randomLayer(10, 800, 1)
  const state = { ...STATE, rowHeight: STATE.canvasHeight, markSizes: [12] }
  const { hits, probes } = parity(['rule'], { layers: [layer] }, state)
  expect(hits).toBeGreaterThan(probes / 10)
})

test('a reversed block and a scrolled plot answer the same', () => {
  const layer = randomLayer(3, 1500, 20)
  const { hits, probes } = parity(
    ['bar'],
    { layers: [layer] },
    { ...STATE, scrollTop: 95 },
    { block: { ...BLOCK, reversed: true } },
  )
  expect(hits).toBeGreaterThan(probes / 4)
})

const SQUASHED = {
  ...STATE,
  rowHeight: STATE.canvasHeight / 400,
  markSizes: [6, 6],
}

test('rules over squashed rows answer the same, their strokes reaching past the band', () => {
  const layers = [randomLayer(4, 1200, 400)]
  const { hits, probes } = parity(['rule'], { layers }, SQUASHED)
  expect(hits).toBeGreaterThan(probes / 4)
})

// A line's square caps stand half its width past its bp, where neither lookup
// reaches, so the ink over every instance can answer one they both miss.
test('lines over squashed rows answer what the Flatbush answers', () => {
  const layers = [randomLayer(5, 1200, 400), randomLayer(4, 1200, 400)]
  const { hits, probes } = parity(['line', 'rule'], { layers }, SQUASHED, {
    truth: false,
  })
  expect(hits).toBeGreaterThan(probes / 4)
})

test('keys the row table places, hides and reorders answer the same', () => {
  const keys = 16
  const slot = new Uint32Array(keys)
  for (let k = 0; k < keys; k++) {
    slot[k] = k % 5 === 0 ? HIDDEN_ROW : (k * 7) % keys
  }
  const layer = randomLayer(6, 1500, keys + 2)
  const state = {
    ...STATE,
    rowHeight: STATE.canvasHeight / keys,
    rowTable: buildRowTable(slot),
  }
  const { hits, probes } = parity(['bar'], { layers: [layer] }, state)
  expect(hits).toBeGreaterThan(probes / 5)
})

test('a facet with a hidden section answers from the rows it kept', () => {
  const layer = randomLayer(7, 1500, 12)
  const region: MarkRegionData = {
    layers: [layer],
    facet: [
      { key: 'a', firstRow: 0, rowCount: 4 },
      { key: 'b', firstRow: 4, rowCount: 4 },
      { key: 'c', firstRow: 8, rowCount: 4 },
    ],
  }
  const field = {
    field: 'group',
    compare: (p: string, q: string) => p.localeCompare(q),
    sectionLabel: (key: string) => key,
  } as unknown as CategoricalField
  const shown = facetRegion(
    region,
    facetLayout([region], field, new Set(['b'])),
  )
  expect(shown.layers[0]!.count).toBeLessThan(layer.count)
  const { hits, probes } = parity(['bar'], shown, STATE)
  expect(hits).toBeGreaterThan(probes / 5)
})

test('the density tier builds no Flatbush for a bar, and answers the same', () => {
  const rand = lcg(8)
  const n = 400
  const starts = new Uint32Array(n)
  const ends = new Uint32Array(n)
  const scores = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    starts[i] = i * 3
    ends[i] = (i + 1) * 3
    scores[i] = rand() * 12
  }
  const data = densityRegionData({ starts, ends, scores }, 1, 0, 1, false)
  const state = { ...STATE, rowHeight: STATE.canvasHeight }
  const { hits, probes } = parity(['bar'], data, state)
  expect(hits).toBeGreaterThan(probes / 4)
  expect(
    densityRegionData({ starts, ends, scores }, 1, 0, 1, true).layers[0]!
      .flatbush,
  ).toBeDefined()
})
