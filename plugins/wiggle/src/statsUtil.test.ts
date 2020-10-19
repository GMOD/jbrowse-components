import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { from } from 'rxjs'
import {
  calcStdFromSums,
  rectifyStats,
  scoresToStats,
  calcPerBaseStats,
  UnrectifiedFeatureStats,
} from './statsUtil'

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
    rectifyStats({ basesCovered: 0 } as UnrectifiedFeatureStats).scoreMean,
  ).toEqual(0)
  const s = rectifyStats({
    featureCount: 10,
    scoreSum: 1000,
  } as UnrectifiedFeatureStats)

  expect(s.scoreMean).toEqual(100)
  expect(s.featureCount).toEqual(10)

  expect(
    rectifyStats({
      featureCount: 3,
      scoreSum: 6,
      scoreSumSquares: 14,
    } as UnrectifiedFeatureStats).scoreStdDev,
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

// peter TODO: fix this test
test('calc per base stats', () => {
  // one score at start
  expect(
    calcPerBaseStats({ refName: 'ctgA', start: 0, end: 9 }, [
      new SimpleFeature({ id: 1, data: { start: 0, end: 1, score: 10 } }),
    ]),
  ).toEqual([10, 0, 0, 0, 0, 0, 0, 0, 0])
  // multiple features
  expect(
    calcPerBaseStats({ refName: 'ctgA', start: 0, end: 9 }, [
      new SimpleFeature({ id: 1, data: { start: 0, end: 1, score: 10 } }),
      new SimpleFeature({ id: 2, data: { start: 8, end: 9, score: 10 } }),
    ]),
  ).toEqual([10, 0, 0, 0, 0, 0, 0, 0, 10])
  // multiple features
  expect(
    calcPerBaseStats({ refName: 'ctgA', start: 15, end: 30 }, [
      new SimpleFeature({ id: 1, data: { start: 10, end: 20, score: 10 } }),
      new SimpleFeature({ id: 2, data: { start: 25, end: 26, score: 10 } }),
    ]),
  ).toEqual([10, 10, 10, 10, 10, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0])
  // feature starts before region
  expect(
    calcPerBaseStats({ refName: 'ctgA', start: 10, end: 19 }, [
      new SimpleFeature({ id: 1, data: { start: 5, end: 15, score: 10 } }),
      new SimpleFeature({ id: 1, data: { start: 18, end: 26, score: 10 } }),
    ]),
  ).toEqual([10, 10, 10, 10, 10, 0, 0, 0, 10])
})
