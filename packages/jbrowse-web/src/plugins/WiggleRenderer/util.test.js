import { getScale } from './util'

test('linear scale', () => {
  const dom = [0, 100]
  const range = [0, 100]
  const scale = getScale('linear', dom, range)
  expect(scale.domain()).toEqual(dom)
})

test('log scale', () => {
  const dom = [1, 100]
  const range = [0, 100]
  const scale = getScale('log', dom, range)
  expect(scale.domain()).toEqual(dom)
})

test('test inverted', () => {
  const dom = [1, 100]
  const range = [0, 100]
  const scale = getScale('log', dom, range, { inverted: true })
  expect(scale.domain()).toEqual(dom)
  expect(scale.range()).toEqual(range.reverse())
})

test('test minScore', () => {
  const dom = [0, 100]
  const range = [0, 100]
  const s = getScale('linear', dom, range, { minScore: 50 })
  expect(s.domain()).toEqual([50, 100])
})

test('test min and max score', () => {
  const dom = [1, 100]
  const range = [0, 100]
  const s = getScale('linear', dom, range, { minScore: 50, maxScore: 70 })
  expect(s.domain()).toEqual([50, 70])
})
