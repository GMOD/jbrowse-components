import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { makeColorEvaluator } from './makeColorEvaluator.ts'
import { DEFAULT_MANHATTAN_COLOR } from './rpcTypes.ts'

const jexl = createJexlInstance()

// ABGR uint32 packing: 0xAABBGGRR
function abgr(r: number, g: number, b: number, a = 255) {
  return (
    (((a & 0xff) << 24) |
      ((b & 0xff) << 16) |
      ((g & 0xff) << 8) |
      (r & 0xff)) >>>
    0
  )
}

const f1 = new SimpleFeature({
  uniqueId: 'a',
  refName: 'chr1',
  start: 100,
  end: 101,
  score: 5,
})
const f2 = new SimpleFeature({
  uniqueId: 'b',
  refName: 'chr1',
  start: 200,
  end: 201,
  score: 6,
})

test('literal CSS color → same ABGR for every feature', () => {
  const fn = makeColorEvaluator('green', jexl)
  expect(fn(f1)).toBe(fn(f2))
})

test('jexl callback evaluates per feature', () => {
  // alternate red / blue based on start
  const fn = makeColorEvaluator(
    "jexl:get(feature,'start') == 100 ? 'red' : 'blue'",
    jexl,
  )
  expect(fn(f1)).toBe(abgr(255, 0, 0))
  expect(fn(f2)).toBe(abgr(0, 0, 255))
})

test('jexl with arithmetic on feature scores', () => {
  // score==5 → black; score==6 → white
  const fn = makeColorEvaluator(
    "jexl:get(feature,'score') == 5 ? 'black' : 'white'",
    jexl,
  )
  expect(fn(f1)).toBe(abgr(0, 0, 0))
  expect(fn(f2)).toBe(abgr(255, 255, 255))
})

test('non-string jexl result → visible default, not transparent', () => {
  // a branch that yields undefined (no else) must not render an invisible point
  const fn = makeColorEvaluator(
    "jexl:get(feature,'start') == 100 ? 'red' : undefined",
    jexl,
  )
  expect(fn(f1)).toBe(abgr(255, 0, 0))
  const fallback = fn(f2)
  expect(fallback).not.toBe(0)
  expect(fallback).toBe(cssColorToABGR(DEFAULT_MANHATTAN_COLOR))
})
