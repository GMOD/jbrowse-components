import { alignmentsFragments } from './exportRCode.ts'

import type { AlignmentsRParams } from './exportRCode.ts'

const base: AlignmentsRParams = {
  trackId: 'aln',
  trackName: 'My reads',
  uri: 'https://example.com/reads.bam',
  showCoverage: true,
  showPileup: true,
  colorBy: 'normal',
  showLowFreqMismatches: false,
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
})

test('both panels draw MD-tag mismatches (reference-free SNP coloring)', () => {
  const [cov, pileup] = alignmentsFragments(base)
  // SNP coverage: per-base mismatch counts stacked over the grey total
  expect(cov!.helpers).toEqual(
    expect.arrayContaining(['bam_mismatches', 'base_colors']),
  )
  expect(cov!.plotExpr).toContain('bam_mismatches(aln, chrom, start, end)')
  expect(cov!.plotExpr).toContain('aggregate(read_index ~ refpos + base')

  // pileup: per-base mismatch ticks joined to their row, colored by read base
  expect(pileup!.helpers).toEqual(
    expect.arrayContaining(['bam_mismatches', 'base_colors']),
  )
  expect(pileup!.plotExpr).toContain('reads$row[mm$read_index]')
  expect(pileup!.plotExpr).toContain('base_colors[toupper(mm$base)]')
  // read bodies + mismatch ticks share one identity fill scale (no ggnewscale)
  expect(pileup!.plotExpr).toContain('scale_fill_identity()')
})

test('pileup colors reads by the resolved color-by scheme', () => {
  // default (normal) — grey read bodies via read_fill_colors
  const [, normal] = alignmentsFragments(base)
  expect(normal!.helpers).toContain('read_fill_colors')
  expect(normal!.plotExpr).toContain('read_fill_colors(reads, "normal")')

  // strand / mapping quality / insert size each thread through
  expect(
    alignmentsFragments({ ...base, colorBy: 'strand' })[1]!.plotExpr,
  ).toContain('read_fill_colors(reads, "strand")')
  expect(
    alignmentsFragments({ ...base, colorBy: 'mappingQuality' })[1]!.plotExpr,
  ).toContain('read_fill_colors(reads, "mappingQuality")')

  // unsupported paired-end orientation schemes fall back to normal grey
  expect(
    alignmentsFragments({ ...base, colorBy: 'pairOrientation' })[1]!.plotExpr,
  ).toContain('read_fill_colors(reads, "normal")')
  // insert-size family collapses onto the insertSize scheme
  expect(
    alignmentsFragments({ ...base, colorBy: 'insertSizeGradient' })[1]!.plotExpr,
  ).toContain('read_fill_colors(reads, "insertSize")')
})

test('SNP coverage thresholds low-frequency mismatches by default', () => {
  const [cov] = alignmentsFragments(base)
  expect(cov!.helpers).toContain('snp_freq_threshold')
  expect(cov!.plotExpr).toContain('show_low_freq <- FALSE')
  expect(cov!.plotExpr).toContain('snp_freq_threshold(snp$depth)')

  // showLowFreqMismatches keeps every mismatch (no thresholding)
  const [covAll] = alignmentsFragments({ ...base, showLowFreqMismatches: true })
  expect(covAll!.plotExpr).toContain('show_low_freq <- TRUE')
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
