import { calcStdFromSums, rectifyStats } from './util'

test('calc std', () => {
  const s = [1, 2, 3]
  const sum = s.reduce((a, b) => a + b)
  const sumSq = s.reduce((a, b) => a + b * b)
  const stddev = calcStdFromSums(sum, sumSq, s.length)
  expect(stddev).toBeCloseTo(0.8164965809) // calculated from a webapp
})
