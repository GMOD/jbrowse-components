import { feat, testLd as ld } from './ldTestHelpers.ts'
import { makeLdR2Evaluator } from './makeLdR2Evaluator.ts'

test('index SNP (by name) is r²=1', () => {
  const fn = makeLdR2Evaluator(ld, 'rsIndex', 'chr1')
  expect(fn(feat({ name: 'rsIndex', start: 100 }))).toBe(1)
})

test('index SNP (by chr:bp) is r²=1', () => {
  const fn = makeLdR2Evaluator(ld, 'chr1:100', 'chr1')
  expect(fn(feat({ start: 99 }))).toBe(1)
})

test('partner looked up by name', () => {
  const fn = makeLdR2Evaluator(ld, 'rsIndex', 'chr1')
  expect(fn(feat({ name: 'rsB', start: 500 }))).toBe(0.9)
})

test('partner looked up by position when name is absent', () => {
  const fn = makeLdR2Evaluator(ld, 'rsIndex', 'chr1')
  expect(fn(feat({ start: 299 }))).toBe(0.3)
})

test('SNP absent from the LD data is NaN', () => {
  const fn = makeLdR2Evaluator(ld, 'rsIndex', 'chr1')
  expect(fn(feat({ name: 'rsUnknown', start: 999 }))).toBeNaN()
})
