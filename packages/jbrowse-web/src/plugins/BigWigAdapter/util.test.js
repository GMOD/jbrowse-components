import {
  calcStdFromSums,
  rectifyStats,
  scoresToStats,
  calcRealStats,
} from './util'

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
  expect(rectifyStats({ basesCovered: 0 }).scoreMean).toEqual(0)
  const s = {
    otherThing: 'hi',
    featureCount: 10,
    basesCovered: 100,
    scoreSum: 1000,
  }

  expect(rectifyStats(s).scoreMean).toEqual(10)
  expect(rectifyStats(s).otherThing).toEqual('hi')
  expect(rectifyStats(s).featureCount).toEqual(10)

  const s2 = {
    basesCovered: 3,
    featureCount: 3,
    scoreSum: 6,
    scoreSumSquares: 14,
  }
  expect(rectifyStats(s2).scoreStdDev).toEqual(1) // calculated from a webapp
  expect(rectifyStats(s2, true).scoreStdDev).toEqual(1) // use featureCount as the sample size N
})

test('scores to stats', () => {
  const ret = scoresToStats({ start: 0, end: 2 }, [
    { score: 1 },
    { score: 2 },
    { score: 3 },
  ])
  expect(ret.scoreMean).toEqual(2)
  expect(ret.featureDensity).toEqual(1)
  expect(ret.scoreMax).toEqual(3)
  expect(ret.scoreMin).toEqual(1)
  expect(ret.scoreStdDev).toEqual(1) // calculated from a webapp
})

test('calc real stats', () => {
  expect(
    calcRealStats({ start: 0, end: 9 }, [{ start: 0, end: 1, score: 10 }]),
  ).toEqual([10, 0, 0, 0, 0, 0, 0, 0, 0])
  expect(
    calcRealStats({ start: 0, end: 9 }, [
      { start: 0, end: 1, score: 10 },
      { start: 8, end: 9, score: 10 },
    ]),
  ).toEqual([10, 0, 0, 0, 0, 0, 0, 0, 10])
  expect(
    calcRealStats({ start: 15, end: 30 }, [
      { start: 10, end: 20, score: 10 },
      { start: 25, end: 26, score: 10 },
    ]),
  ).toEqual([10, 10, 10, 10, 10, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0])
})
