import SimpleFeature from './simpleFeature'
import { from } from 'rxjs'
import {
  calcStdFromSums,
  rectifyStats,
  scoresToStats,
  calcPerBaseStats,
  UnrectifiedQuantitativeStats,
} from './stats'

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
    { end: 2, refName: 'ctgA', start: 0 },
    from([
      new SimpleFeature({ data: { end: 1, score: 1, start: 0 }, id: 1 }),
      new SimpleFeature({ data: { end: 2, score: 2, start: 1 }, id: 2 }),
      new SimpleFeature({ data: { end: 3, score: 3, start: 2 }, id: 3 }),
    ]),
  )
  expect(ret.scoreMean).toEqual(2)
  expect(ret.featureDensity).toEqual(1)
  expect(ret.scoreMax).toEqual(3)
  expect(ret.scoreMin).toEqual(1)
  expect(ret.scoreStdDev).toEqual(1) // calculated from a webapp
})

// peter TODO: fix this test
test('calc per base stats', () => {
  // one score at start
  expect(
    calcPerBaseStats({ end: 9, refName: 'ctgA', start: 0 }, [
      new SimpleFeature({ data: { end: 1, score: 10, start: 0 }, id: 1 }),
    ]),
  ).toEqual([10, 0, 0, 0, 0, 0, 0, 0, 0])
  // multiple features
  expect(
    calcPerBaseStats({ end: 9, refName: 'ctgA', start: 0 }, [
      new SimpleFeature({ data: { end: 1, score: 10, start: 0 }, id: 1 }),
      new SimpleFeature({ data: { end: 9, score: 10, start: 8 }, id: 2 }),
    ]),
  ).toEqual([10, 0, 0, 0, 0, 0, 0, 0, 10])
  // multiple features
  expect(
    calcPerBaseStats({ end: 30, refName: 'ctgA', start: 15 }, [
      new SimpleFeature({ data: { end: 20, score: 10, start: 10 }, id: 1 }),
      new SimpleFeature({ data: { end: 26, score: 10, start: 25 }, id: 2 }),
    ]),
  ).toEqual([10, 10, 10, 10, 10, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0])
  // feature starts before region
  expect(
    calcPerBaseStats({ end: 19, refName: 'ctgA', start: 10 }, [
      new SimpleFeature({ data: { end: 15, score: 10, start: 5 }, id: 1 }),
      new SimpleFeature({ data: { end: 26, score: 10, start: 18 }, id: 1 }),
    ]),
  ).toEqual([10, 10, 10, 10, 10, 0, 0, 0, 10])
})
