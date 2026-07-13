import { alignmentsFragments } from './exportRCode.ts'

import type { AlignmentsRParams } from './exportRCode.ts'

const base: AlignmentsRParams = {
  trackId: 'aln',
  trackName: 'My reads',
  uri: 'https://example.com/reads.bam',
  showCoverage: true,
  showPileup: true,
}

test('emits a coverage panel and a pileup panel, coverage on top', () => {
  const [cov, pileup] = alignmentsFragments(base)
  expect(cov!.plotVariable).toBe('p_aln_coverage')
  expect(cov!.heightWeight).toBe(1)
  expect(cov!.helpers).toContain('bam_coverage')
  expect(cov!.plotExpr).toContain('bam_coverage(aln, chrom, start, end)')

  expect(pileup!.plotVariable).toBe('p_aln_pileup')
  expect(pileup!.heightWeight).toBe(3)
  expect(pileup!.helpers).toEqual(
    expect.arrayContaining(['read_bam', 'pileup_layout']),
  )
  expect(pileup!.plotExpr).toContain(
    'pileup_layout(read_bam(aln, chrom, start, end))',
  )
  expect(pileup!.plotExpr).toContain('fill = strand')
})

test('both panels share one file-path setup and pure Bioc packages', () => {
  const fragments = alignmentsFragments(base)
  expect(new Set(fragments.map(f => f.setup)).size).toBe(1)
  expect(fragments[0]!.setup).toBe('aln <- "https://example.com/reads.bam"')
  for (const f of fragments) {
    expect(f.packages).toEqual(['Rsamtools', 'GenomicAlignments', 'ggplot2'])
  }
})

test('respects showCoverage / showPileup toggles', () => {
  expect(alignmentsFragments({ ...base, showCoverage: false })).toHaveLength(1)
  expect(alignmentsFragments({ ...base, showCoverage: false })[0]!.plotVariable).toBe(
    'p_aln_pileup',
  )
  expect(alignmentsFragments({ ...base, showPileup: false })).toHaveLength(1)
  expect(alignmentsFragments({ ...base, showPileup: false })[0]!.plotVariable).toBe(
    'p_aln_coverage',
  )
})
