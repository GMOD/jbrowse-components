import { from } from 'rxjs'

import SimpleFeature from './simpleFeature.ts'
import { calcStdFromSums, rectifyStats, scoresToStats } from './stats.ts'
import { aggregateQuantitativeStats } from '../data_adapters/BaseAdapter/stats.ts'

import type { UnrectifiedQuantitativeStats } from './stats.ts'

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
  // for non-summary features, scoreMeanMin/Max equal scoreMin/Max
  expect(ret.scoreMeanMin).toEqual(1)
  expect(ret.scoreMeanMax).toEqual(3)
})

test('scores to stats with summary features tracks scoreMeanMin/Max', async () => {
  const ret = await scoresToStats(
    { refName: 'ctgA', start: 0, end: 300 },
    from([
      new SimpleFeature({
        id: 1,
        data: {
          start: 0,
          end: 100,
          score: 5,
          maxScore: 10,
          minScore: 1,
          summary: true,
        },
      }),
      new SimpleFeature({
        id: 2,
        data: {
          start: 100,
          end: 200,
          score: 8,
          maxScore: 20,
          minScore: 3,
          summary: true,
        },
      }),
      new SimpleFeature({
        id: 3,
        data: {
          start: 200,
          end: 300,
          score: 3,
          maxScore: 15,
          minScore: 0,
          summary: true,
        },
      }),
    ]),
  )
  // scoreMin/Max use minScore/maxScore from summary features
  expect(ret.scoreMin).toEqual(0)
  expect(ret.scoreMax).toEqual(20)
  // scoreMeanMin/Max use the mean (score) values
  expect(ret.scoreMeanMin).toEqual(3)
  expect(ret.scoreMeanMax).toEqual(8)
})

test('aggregateQuantitativeStats preserves scoreMeanMin/Max', () => {
  const stats = [
    rectifyStats({
      scoreMin: 0,
      scoreMax: 20,
      scoreMeanMin: 3,
      scoreMeanMax: 8,
      scoreSum: 16,
      scoreSumSquares: 98,
      featureCount: 3,
      basesCovered: 300,
    }),
    rectifyStats({
      scoreMin: 2,
      scoreMax: 25,
      scoreMeanMin: 5,
      scoreMeanMax: 12,
      scoreSum: 27,
      scoreSumSquares: 193,
      featureCount: 3,
      basesCovered: 300,
    }),
  ]
  const ret = aggregateQuantitativeStats(stats)
  expect(ret.scoreMin).toEqual(0)
  expect(ret.scoreMax).toEqual(25)
  expect(ret.scoreMeanMin).toEqual(3)
  expect(ret.scoreMeanMax).toEqual(12)
})

test('aggregateQuantitativeStats works without scoreMeanMin/Max', () => {
  const stats = [
    rectifyStats({
      scoreMin: 0,
      scoreMax: 20,
      scoreSum: 16,
      scoreSumSquares: 98,
      featureCount: 3,
      basesCovered: 300,
    }),
    rectifyStats({
      scoreMin: 2,
      scoreMax: 25,
      scoreSum: 27,
      scoreSumSquares: 193,
      featureCount: 3,
      basesCovered: 300,
    }),
  ]
  const ret = aggregateQuantitativeStats(stats)
  expect(ret.scoreMin).toEqual(0)
  expect(ret.scoreMax).toEqual(25)
  expect(ret.scoreMeanMin).toBeUndefined()
  expect(ret.scoreMeanMax).toBeUndefined()
})
