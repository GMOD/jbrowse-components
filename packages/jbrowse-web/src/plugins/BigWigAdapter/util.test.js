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
  expect(rectifyStats({ featureCount: 100, scoreSum: 1000 }).scoreMean).toEqual(
    10,
  ) // simple mean calculation
  expect(rectifyStats({ featureCount: 0 }).scoreMean).toEqual(0) // mean of 0=0
  expect(
    rectifyStats({ otherThing: 'hi', featureCount: 100, scoreSum: 1000 })
      .otherThing,
  ).toEqual('hi') // test that the function returns other attached data
  expect(
    rectifyStats({ featureCount: 3, scoreSum: 6, scoreSumSquares: 14 })
      .scoreStdDev,
  ).toEqual(1) // calculated from a webapp
  expect(
    rectifyStats({ featureCount: 3, basesCovered: 100 }).featureDensity,
  ).toEqual(3 / 100) // test feature denstity
})

test('scores to stats', () => {
  const ret = scoresToStats({ start: 0, end: 2 }, [1, 2, 3])
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
