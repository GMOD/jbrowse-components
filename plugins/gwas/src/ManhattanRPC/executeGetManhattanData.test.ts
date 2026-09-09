import Flatbush from '@jbrowse/core/util/flatbush'
import createJexlInstance from '@jbrowse/core/util/jexl'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import {
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '@jbrowse/render-core/shaders/pointMarkConsts'

import { buildManhattanResult } from './executeGetManhattanData.ts'
import { defaultGlyph } from './rpcTypes.ts'

import type { ManhattanReaders } from './executeGetManhattanData.ts'
import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()

function feature(uniqueId: string, start: number, score: number): Feature {
  return new SimpleFeature({
    uniqueId,
    refName: '1',
    start,
    end: start + 1,
    score,
  })
}

function svFeature(
  uniqueId: string,
  start: number,
  end: number,
  svtype: string,
): Feature {
  return new SimpleFeature({
    uniqueId,
    refName: '1',
    start,
    end,
    score: 5,
    svtype,
  })
}

function build(
  features: Feature[],
  readers: Partial<ManhattanReaders> = {},
  scoreField = 'score',
) {
  return buildManhattanResult(
    features,
    scoreField,
    { color: () => 0xff00ffff, glyph: defaultGlyph, ...readers },
    { jexl },
  ).result
}

test('the encoder packs the channels: position, score, color per feature', () => {
  const r = build([
    feature('a', 10, 1.5),
    feature('b', 200, 7.25),
    feature('c', 3000, 4),
  ])
  expect(r.count).toBe(3)
  expect(Array.from(r.x)).toEqual([10, 200, 3000])
  expect(Array.from(r.y)).toEqual([1.5, 7.25, 4])
  expect(Array.from(r.color)).toEqual([0xff00ffff, 0xff00ffff, 0xff00ffff])
  expect(r.yMin).toBe(1.5)
  expect(r.yMax).toBe(7.25)
  expect(Flatbush.from(r.flatbushData!).search(190, 7, 210, 8)).toEqual([1])
})

test('captures end and derives the glyph from svtype (INS → triangle)', () => {
  const r = build([
    svFeature('del', 100, 2600, 'DEL'),
    svFeature('ins', 300, 301, 'INS'),
    feature('snp', 500, 3),
  ])
  expect(Array.from(r.x2)).toEqual([2600, 301, 501])
  expect(Array.from(r.glyph)).toEqual([GLYPH_DISC, GLYPH_TRIANGLE, GLYPH_DISC])
})

test('no r² array without an r² reader (normal coloring)', () => {
  const r = build([feature('a', 0, 1)])
  expect(r.r2s).toBeUndefined()
  expect(r.scale).toBeUndefined()
})

test('the r² channel stays aligned with the admitted features', () => {
  const scoreless = new SimpleFeature({
    uniqueId: 'n',
    refName: '1',
    start: 50,
    end: 51,
  })
  const r = build([feature('a', 0, 1), scoreless, feature('b', 1, 5)], {
    r2: f => (f.get('start') === 0 ? 1 : 0.4),
  })
  expect(r.count).toBe(2)
  expect(r.r2s).toHaveLength(2)
  expect(r.r2s![0]).toBe(1)
  expect(r.r2s![1]).toBeCloseTo(0.4)
})

test('scoreField reads another feature field as y, skipping features without one', () => {
  const withFst = (id: string, start: number, fst: number) =>
    new SimpleFeature({
      uniqueId: id,
      refName: '1',
      start,
      end: start + 1,
      score: 1000,
      fst,
    })
  const r = build(
    [withFst('a', 10, 0.2), feature('b', 20, 7), withFst('c', 30, 0.9)],
    {},
    'fst',
  )
  expect(Array.from(r.x)).toEqual([10, 30])
  expect(r.y[0]).toBeCloseTo(0.2)
  expect(r.y[1]).toBeCloseTo(0.9)
  expect(r.yMax).toBeCloseTo(0.9)
})

test('the scale the color reader filled rides in the payload with the index flag', () => {
  const scale = {
    kind: 'categorical' as const,
    field: 'pop',
    entries: [{ label: 'CEU', color: 0xff00ffff }],
  }
  const r = build([feature('a', 0, 1)], { scale, indexFound: true })
  expect(r.scale).toBe(scale)
  expect(r.indexFound).toBe(true)
})

test('the r² buffer is transferred beside the channels', () => {
  const { result, transferables } = buildManhattanResult(
    [feature('a', 0, 1)],
    'score',
    { color: () => 0, glyph: defaultGlyph, r2: () => 0.5 },
    { jexl },
  )
  expect(transferables).toContain(result.r2s!.buffer)
  expect(transferables).toContain(result.x.buffer)
})
