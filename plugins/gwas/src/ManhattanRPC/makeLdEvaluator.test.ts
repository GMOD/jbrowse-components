import { feat, testLd as ld } from './ldTestHelpers.ts'
import { makeLdEvaluator } from './makeLdEvaluator.ts'
import { GLYPH_INDEX, GLYPH_INSERTION, GLYPH_POINT } from './rpcTypes.ts'
import { ldBinColor, ldIndexColor } from '../LinearManhattanDisplay/ldBins.ts'

test('index SNP (by name): index color, r²=1', () => {
  const { evalColor, evalR2 } = makeLdEvaluator(ld, 'rsIndex', 'chr1')
  const f = feat({ name: 'rsIndex', start: 100 })
  expect(evalColor(f)).toBe(ldIndexColor)
  expect(evalR2(f)).toBe(1)
})

test('index SNP (by chr:bp): index color, r²=1', () => {
  const { evalColor, evalR2 } = makeLdEvaluator(ld, 'chr1:100', 'chr1')
  const f = feat({ start: 99 })
  expect(evalColor(f)).toBe(ldIndexColor)
  expect(evalR2(f)).toBe(1)
})

test('partner looked up by name', () => {
  const { evalColor, evalR2 } = makeLdEvaluator(ld, 'rsIndex', 'chr1')
  const f = feat({ name: 'rsB', start: 500 })
  expect(evalColor(f)).toBe(ldBinColor(0.9))
  expect(evalR2(f)).toBe(0.9)
})

test('partner looked up by position when name is absent', () => {
  const { evalColor, evalR2 } = makeLdEvaluator(ld, 'rsIndex', 'chr1')
  const f = feat({ start: 299 })
  expect(evalColor(f)).toBe(ldBinColor(0.3))
  expect(evalR2(f)).toBe(0.3)
})

test('SNP absent from the LD data: grey color, NaN r²', () => {
  const { evalColor, evalR2 } = makeLdEvaluator(ld, 'rsIndex', 'chr1')
  const f = feat({ name: 'rsUnknown', start: 999 })
  expect(evalColor(f)).toBe(ldBinColor(undefined))
  expect(evalR2(f)).toBeNaN()
})

test('glyph: index → diamond, insertion → triangle, others → point', () => {
  const { evalGlyph } = makeLdEvaluator(ld, 'rsIndex', 'chr1')
  expect(evalGlyph(feat({ name: 'rsIndex', start: 100 }))).toBe(GLYPH_INDEX)
  expect(evalGlyph(feat({ name: 'rsB', start: 500, svtype: 'INS' }))).toBe(
    GLYPH_INSERTION,
  )
  expect(evalGlyph(feat({ name: 'rsB', start: 500 }))).toBe(GLYPH_POINT)
})

test('index takes precedence over insertion glyph', () => {
  const { evalGlyph } = makeLdEvaluator(ld, 'rsIndex', 'chr1')
  expect(
    evalGlyph(feat({ name: 'rsIndex', start: 100, svtype: 'INS' })),
  ).toBe(GLYPH_INDEX)
})

test('memoized lookup is independent of color/r² call order', () => {
  const { evalColor, evalR2 } = makeLdEvaluator(ld, 'rsIndex', 'chr1')
  const partner = feat({ name: 'rsB', start: 500 })
  const absent = feat({ name: 'rsUnknown', start: 999 })
  // r² first, then color, then a different feature, then back — each read
  // reflects the feature passed, not a stale memo
  expect(evalR2(partner)).toBe(0.9)
  expect(evalColor(partner)).toBe(ldBinColor(0.9))
  expect(evalR2(absent)).toBeNaN()
  expect(evalColor(partner)).toBe(ldBinColor(0.9))
})
