import { calcStdFromSums, rectifyStats } from './util'

test('calc std', () => {
  const s = [1, 2, 3]
  const sum = s.reduce((a, b) => a + b)
  const sumSq = s.reduce((a, b) => a + b * b)
  const stddev = calcStdFromSums(sum, sumSq, s.length)
  expect(stddev).toBeCloseTo(0.8164965809) // calculated from a webapp
  expect(calcStdFromSums(100, 100, 0)).toEqual(0) // fake thing where list "n" is 0
  expect(calcStdFromSums(100000, 100, 5)).toEqual(0) // fake thing where sumSq probably wrong
})

test('test rectify', () => {
  expect(rectifyStats({ featureCount: 100, scoreSum: 1000 }).scoreMean).toEqual(
    10,
  )
  expect(rectifyStats({ featureCount: 0 }).scoreMean).toEqual(0)
  expect(
    rectifyStats({ otherThing: 'hi', featureCount: 100, scoreSum: 1000 })
      .otherThing,
  ).toEqual('hi')
  expect(
    rectifyStats({ featureCount: 3, scoreSum: 6, scoreSumSquares: 14 })
      .scoreStdDev,
  ).toBeCloseTo(0.8164965809) // calculated from a webapp
  expect(
    rectifyStats({ featureCount: 3, basesCovered: 100 }).featureDensity,
  ).toEqual(3 / 100)
})
