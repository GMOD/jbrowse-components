import { from } from 'rxjs'
import SimpleFeature from './simpleFeature'
import { calcStdFromSums, rectifyStats, scoresToStats } from './stats'
import type { UnrectifiedQuantitativeStats } from './stats'

test('calc std', () => {
  const s = [1, 2, 3]
  const sum = s.reduce((a, b) => a + b)
  const sumSq = s.reduce((a, b) => a + b * b)
  expect(calcStdFromSums(sum, sumSq, s.length, true)).toBeCloseTo(0.8164965809) // calculated from a webapp
  expect(calcStdFromSums(sum, sumSq, s.length, false)).toBeCloseTo(1) // calculated from a webapp
  expect(calcStdFromSums(100, 100, 0)).toEqual(0) // fake thing where list "n" is 0
  expect(calcStdFromSums(100000, 100, 5)).toEqual(0) // fake thing where sumSq probably wrong
})

test('test rectify', () => {
  // mean of 0 bases covered = 0
  expect(
    rectifyStats({ basesCovered: 0 } as UnrectifiedQuantitativeStats).scoreMean,
  ).toEqual(0)
  const s = rectifyStats({
    featureCount: 10,
    scoreSum: 1000,
  } as UnrectifiedQuantitativeStats)

  expect(s.scoreMean).toEqual(100)
  expect(s.featureCount).toEqual(10)

  expect(
    rectifyStats({
      featureCount: 3,
      scoreSum: 6,
      scoreSumSquares: 14,
    } as UnrectifiedQuantitativeStats).scoreStdDev,
  ).toEqual(1) // calculated from a webapp about sample standard deviations
})

test('scores to stats', async () => {
  const ret = await scoresToStats(
    { refName: 'ctgA', start: 0, end: 2 },
    from([
      new SimpleFeature({ id: 1, data: { start: 0, end: 1, score: 1 } }),
      new SimpleFeature({ id: 2, data: { start: 1, end: 2, score: 2 } }),
      new SimpleFeature({ id: 3, data: { start: 2, end: 3, score: 3 } }),
    ]),
  )
  expect(ret.scoreMean).toEqual(2)
  expect(ret.featureDensity).toEqual(1)
  expect(ret.scoreMax).toEqual(3)
  expect(ret.scoreMin).toEqual(1)
  expect(ret.scoreStdDev).toEqual(1) // calculated from a webapp
})
