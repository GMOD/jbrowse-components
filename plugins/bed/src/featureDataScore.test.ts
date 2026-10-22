import { featureData, makeParser } from './util.ts'

const columnNames = ['chrom', 'chromStart', 'chromEnd', 'name', 'pval']

function scoreOf(pval: string) {
  return featureData({
    splitLine: ['1', '999', '1000', 'rs1', pval],
    refName: '1',
    start: 999,
    end: 1000,
    parser: makeParser({ columnNames }),
    uniqueId: 'u',
    scoreColumn: 'pval',
  }).score
}

// `Number('')` is 0, which a `negLog10` score transform turns into the top of
// a Manhattan plot's axis.
test('an empty score column leaves the score unset, not 0', () => {
  expect(scoreOf('')).toBeUndefined()
  expect(scoreOf('0')).toBe(0)
  expect(scoreOf('1e-8')).toBe(1e-8)
})
