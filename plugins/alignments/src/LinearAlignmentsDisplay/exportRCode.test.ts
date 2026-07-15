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
  modificationThreshold: 0.1,
  linkReads: false,
  isCram: false,
  reference: '',
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

  // strand / mapping quality / insert size / pair orientation each thread through
  expect(
    alignmentsFragments({ ...base, colorBy: 'strand' })[1]!.plotExpr,
  ).toContain('read_fill_colors(reads, "strand")')
  expect(
    alignmentsFragments({ ...base, colorBy: 'mappingQuality' })[1]!.plotExpr,
  ).toContain('read_fill_colors(reads, "mappingQuality")')
  expect(
    alignmentsFragments({ ...base, colorBy: 'pairOrientation' })[1]!.plotExpr,
  ).toContain('read_fill_colors(reads, "pairOrientation")')
  // pileup reads the mate-derived orientation columns from read_bam
  expect(
    alignmentsFragments({ ...base, colorBy: 'pairOrientation' })[1]!.helpers,
  ).toContain('pair_orientation')
  // insert-size family collapses onto the insertSize scheme
  expect(
    alignmentsFragments({ ...base, colorBy: 'insertSizeGradient' })[1]!
      .plotExpr,
  ).toContain('read_fill_colors(reads, "insertSize")')
})

test('modifications scheme overlays MM/ML mod ticks instead of mismatches', () => {
  const [, pileup] = alignmentsFragments({ ...base, colorBy: 'modifications' })
  // grey read bodies (mods stand out), mod ticks colored by modification type
  expect(pileup!.plotExpr).toContain('read_fill_colors(reads, "normal")')
  expect(pileup!.helpers).toEqual(
    expect.arrayContaining(['bam_modifications', 'mod_colors']),
  )
  expect(pileup!.helpers).not.toContain('bam_mismatches')
  expect(pileup!.plotExpr).toContain(
    'bam_modifications(aln, chrom, start, end, min_prob)',
  )
  expect(pileup!.plotExpr).toContain('mod_colors(mm$modtype)')
  expect(pileup!.plotExpr).toContain('reads$row[mm$read_index]')
  // the probability threshold is emitted as an editable var (JBrowse default 0.1)
  expect(pileup!.plotExpr).toContain('min_prob <- 0.1')

  // methylation resolves to the same modifications overlay
  expect(
    alignmentsFragments({ ...base, colorBy: 'methylation' })[1]!.helpers,
  ).toContain('bam_modifications')
})

test('perBaseQuality scheme overlays per-base Phred-colored rects', () => {
  const [, pileup] = alignmentsFragments({ ...base, colorBy: 'perBaseQuality' })
  // grey read bodies, every aligned base recolored by its quality score
  expect(pileup!.plotExpr).toContain('read_fill_colors(reads, "normal")')
  expect(pileup!.helpers).toEqual(
    expect.arrayContaining(['bam_base_quality', 'quality_colors']),
  )
  expect(pileup!.helpers).not.toContain('bam_mismatches')
  expect(pileup!.plotExpr).toContain('bam_base_quality(aln, chrom, start, end)')
  expect(pileup!.plotExpr).toContain('quality_colors(bq$score)')
  expect(pileup!.plotExpr).toContain('reads$row[bq$read_index]')
  // one rect per base is dense; a visible cap skips the overlay over wide regions
  // (like JBrowse only drawing per-base quality zoomed in) so R can't OOM
  expect(pileup!.plotExpr).toContain('max_quality_rects <- 200000')
})

test('modification threshold flows from the model to the emitted min_prob var', () => {
  const [, pileup] = alignmentsFragments({
    ...base,
    colorBy: 'modifications',
    modificationThreshold: 0.5,
  })
  expect(pileup!.plotExpr).toContain('min_prob <- 0.5')
})

test('linkReads uses chain layout with mate/supplementary connectors', () => {
  // default flat pileup
  const [, flat] = alignmentsFragments(base)
  expect(flat!.helpers).toContain('pileup_layout')
  expect(flat!.plotExpr).toContain(
    'pileup_layout(read_bam(aln, chrom, start, end))',
  )
  expect(flat!.plotExpr).not.toContain('link_reads')

  // linkReads: group by read name into chains + draw gap connectors
  const [, linked] = alignmentsFragments({ ...base, linkReads: true })
  expect(linked!.helpers).toContain('link_reads')
  expect(linked!.helpers).not.toContain('pileup_layout')
  expect(linked!.plotExpr).toContain(
    'link_reads(read_bam(aln, chrom, start, end))',
  )
  // connector segments drawn from linked$links, under the read rects
  expect(linked!.plotExpr).toContain('geom_segment(data = linked$links')
  expect(linked!.plotExpr.indexOf('geom_segment')).toBeLessThan(
    linked!.plotExpr.indexOf('geom_rect'),
  )
})

test('pileup draws soft/hard clip indicator bars at read ends', () => {
  const [, pileup] = alignmentsFragments(base)
  expect(pileup!.helpers).toEqual(
    expect.arrayContaining(['bam_clips', 'clip_colors']),
  )
  expect(pileup!.plotExpr).toContain('bam_clips(aln, chrom, start, end)')
  // vertical bars joined to the read's row, colored by clip type, via a color
  // (not fill) identity scale so they compose with the read/mismatch fill scale
  expect(pileup!.plotExpr).toContain('clips$row <- reads$row[clips$read_index]')
  expect(pileup!.plotExpr).toContain('clip_colors[clips$type]')
  expect(pileup!.plotExpr).toContain('scale_color_identity()')
  // clip bars are orthogonal to color scheme — drawn under modifications too
  expect(
    alignmentsFragments({ ...base, colorBy: 'modifications' })[1]!.plotExpr,
  ).toContain('bam_clips(aln, chrom, start, end)')
})

test('pileup marks CIGAR deletions/skips/insertions', () => {
  const [, pileup] = alignmentsFragments(base)
  expect(pileup!.helpers).toEqual(
    expect.arrayContaining(['bam_indels', 'gap_colors']),
  )
  expect(pileup!.plotExpr).toContain('bam_indels(aln, chrom, start, end)')
  // indels joined to their read row by read_index, like the mismatch/clip overlays
  expect(pileup!.plotExpr).toContain(
    'indels$row <- reads$row[indels$read_index]',
  )
  // deletions = grey full-height rect; skips = erased body + thin teal line;
  // insertions = thin purple tick (all via fixed colors, not the identity scale)
  expect(pileup!.plotExpr).toContain('dels <- indels[indels$type == "D", ]')
  expect(pileup!.plotExpr).toContain('gap_colors[["D"]]')
  expect(pileup!.plotExpr).toContain('skips <- indels[indels$type == "N", ]')
  expect(pileup!.plotExpr).toContain('gap_colors[["N"]]')
  expect(pileup!.plotExpr).toContain('gap_colors[["I"]]')
  // gaps paint before the mismatch ticks (which sit on aligned columns)
  expect(pileup!.plotExpr.indexOf('bam_indels')).toBeLessThan(
    pileup!.plotExpr.indexOf('bam_mismatches(aln'),
  )
  // orthogonal to color scheme — drawn under modifications too
  expect(
    alignmentsFragments({ ...base, colorBy: 'modifications' })[1]!.plotExpr,
  ).toContain('bam_indels(aln, chrom, start, end)')
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
  expect(
    alignmentsFragments({ ...base, showCoverage: false })[0]!.plotVariable,
  ).toBe('p_aln_pileup')
  expect(alignmentsFragments({ ...base, showPileup: false })).toHaveLength(1)
  expect(
    alignmentsFragments({ ...base, showPileup: false })[0]!.plotVariable,
  ).toBe('p_aln_coverage')
})
