import { manhattanFragment } from './exportRCode.ts'

import type { ManhattanRParams } from './exportRCode.ts'

const base: ManhattanRParams = {
  trackId: 'gwas',
  trackName: 'GWAS results',
  uri: 'https://example.com/summary_stats.bed.gz',
  scoreColumn: 'neg_log_pvalue',
  color: '#0068d1',
  pointSize: 4,
}

test('reads the BED with read_gwas and emits no bespoke package', () => {
  const f = manhattanFragment(base)
  expect(f.plotVariable).toBe('p_gwas')
  expect(f.setup).toBe('gwas <- "https://example.com/summary_stats.bed.gz"')
  expect(f.helpers).toEqual(['read_gwas', 'bp_axis'])
  // Rsamtools scanTabix path — no bespoke GWAS package
  expect(f.packages).toEqual(['Rsamtools', 'GenomicRanges', 'ggplot2'])
  expect(f.plotExpr).toContain(
    'read_gwas(gwas, chrom, start, end, "neg_log_pvalue")',
  )
  expect(f.plotExpr).not.toMatch(/jb_features|geom_manhattan|scale_x_genomic/)
})

test('draws points against -log10(p) with a genome-wide significance line', () => {
  const f = manhattanFragment(base)
  expect(f.plotExpr).toContain('geom_point(aes(x = pos, y = score)')
  expect(f.plotExpr).toContain('color = "#0068d1"')
  expect(f.plotExpr).toContain('yintercept = -log10(5e-8)')
  expect(f.plotExpr).toContain('y = "-log10(p)"')
})

test('reproduces native score transforms in the y aesthetic', () => {
  expect(
    manhattanFragment({ ...base, scoreTransform: 'none' }).plotExpr,
  ).toContain('y = score)')
  expect(
    manhattanFragment({ ...base, scoreTransform: 'negLog10' }).plotExpr,
  ).toContain('y = -log10(pmax(score, .Machine$double.xmin))')
  expect(
    manhattanFragment({ ...base, scoreTransform: 'negLog10FromLn' }).plotExpr,
  ).toContain('y = -score / log(10)')
})

test('falls back to the default color for a jexl color callback', () => {
  const f = manhattanFragment({
    ...base,
    color: 'jexl:rgb(get(feature,"score"))',
  })
  expect(f.plotExpr).toContain('color = "#0068d1"')
  expect(f.plotExpr).not.toContain('jexl')
})

test('non-identifier track ids become safe R variable names', () => {
  const f = manhattanFragment({ ...base, trackId: '1000g.gwas-hits' })
  expect(f.plotVariable).toBe('p__1000g_gwas_hits')
  expect(f.setup).toBe(
    '_1000g_gwas_hits <- "https://example.com/summary_stats.bed.gz"',
  )
})
