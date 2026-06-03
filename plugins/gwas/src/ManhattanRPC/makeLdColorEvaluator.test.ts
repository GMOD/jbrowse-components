import { feat, testLd as ld } from './ldTestHelpers.ts'
import { makeLdColorEvaluator } from './makeLdColorEvaluator.ts'
import { ldBinColor, ldIndexColor } from '../LinearManhattanDisplay/ldBins.ts'

test('index SNP (by name) gets the index color', () => {
  const fn = makeLdColorEvaluator(ld, 'rsIndex', 'chr1')
  expect(fn(feat({ name: 'rsIndex', start: 100 }))).toBe(ldIndexColor)
})

test('index SNP (by chr:bp) gets the index color', () => {
  const fn = makeLdColorEvaluator(ld, 'chr1:100', 'chr1')
  expect(fn(feat({ start: 99 }))).toBe(ldIndexColor)
})

test('partner looked up by name', () => {
  const fn = makeLdColorEvaluator(ld, 'rsIndex', 'chr1')
  expect(fn(feat({ name: 'rsB', start: 500 }))).toBe(ldBinColor(0.9))
})

test('partner looked up by position when name is absent', () => {
  const fn = makeLdColorEvaluator(ld, 'rsIndex', 'chr1')
  expect(fn(feat({ start: 299 }))).toBe(ldBinColor(0.3))
})

test('SNP absent from the LD data renders grey (undefined r²)', () => {
  const fn = makeLdColorEvaluator(ld, 'rsIndex', 'chr1')
  expect(fn(feat({ name: 'rsUnknown', start: 999 }))).toBe(
    ldBinColor(undefined),
  )
})
