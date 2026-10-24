import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { coverageTooltipBinAt } from './coverageTooltipBin.ts'

function coverage(identityScores: number[]) {
  return {
    ...emptyMafCoverage(100),
    coverageDepths: new Float32Array([4, 4, 4]),
    coverageMaxDepth: 4,
    identityScores: new Float32Array(identityScores),
  }
}

test('the bin under the cursor carries the identity at its position', () => {
  const bin = coverageTooltipBinAt(coverage([0.5, 0.75, 1]), 101, 0.1, false, {
    showAlleles: true,
    minAlleleFraction: 0,
  })
  expect(bin?.position).toBe(101)
  expect(bin?.identity).toBe(0.75)
})

test('a position past the identity scores has no identity', () => {
  const bin = coverageTooltipBinAt(coverage([0.5]), 102, 0.1, false, {
    showAlleles: true,
    minAlleleFraction: 0,
  })
  expect(bin).toBeDefined()
  expect(bin?.identity).toBeNaN()
})

test('a position outside the region has no bin', () => {
  expect(
    coverageTooltipBinAt(coverage([0.5, 0.75, 1]), 500, 0.1, false, {
      showAlleles: true,
      minAlleleFraction: 0,
    }),
  ).toBeUndefined()
})
