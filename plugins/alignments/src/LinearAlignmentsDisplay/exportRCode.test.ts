import { resolveHelpers } from '@jbrowse/plugin-linear-genome-view'

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
  bpPerPx: 1,
}

test('emits a coverage panel and a pileup panel, coverage on top', () => {
  const [cov, pileup] = alignmentsFragments(base)
  expect(cov!.plotVariable).toBe('p_aln_coverage')
  expect(cov!.heightWeight).toBe(1)
  expect(cov!.helpers).toContain('bam_coverage')
  expect(cov!.plotExpr).toContain('bam_coverage(bam, chrom, start, end)')

  expect(pileup!.plotVariable).toBe('p_aln_pileup')
  expect(pileup!.heightWeight).toBe(3)
  expect(pileup!.helpers).toEqual(
    expect.arrayContaining(['read_bam', 'pileup_layout']),
  )
  expect(pileup!.plotExpr).toContain(
    'pileup_layout(reads)',
  )
})

test('both panels draw MD-tag mismatches (reference-free SNP coloring)', () => {
  const [cov, pileup] = alignmentsFragments(base)
  // SNP coverage: per-base mismatch counts stacked over the grey total
  expect(cov!.helpers).toEqual(
    expect.arrayContaining(['bam_mismatches', 'base_colors']),
  )
  expect(cov!.plotExpr).toContain('bam_mismatches(bam, chrom, start, end)')
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

test('coverage panel carves deletions and draws interbase indicators', () => {
  const [cov] = alignmentsFragments(base)
  // bam_coverage now drops D ranges so the grey total dips at deletions like
  // JBrowse (helper body lives in exportR.ts; the panel just calls it)
  expect(cov!.helpers).toEqual(
    expect.arrayContaining([
      'bam_indels',
      'bam_clips',
      'interbase_indicators',
      'gap_colors',
      'clip_colors',
    ]),
  )
  // the SV-breakpoint indicators (insertion/soft-/hard-clip pileups) above the bars
  expect(cov!.plotExpr).toContain('interbase_indicators(bam_indels(')
  expect(cov!.plotExpr).toContain('bam_clips(bam, chrom, start, end), cov0)')
  // colored by the dominant event, drawn as a down-triangle above the histogram
  expect(cov!.plotExpr).toContain(
    'c(I = gap_colors[["I"]], S = clip_colors[["S"]], H = clip_colors[["H"]])',
  )
  expect(cov!.plotExpr).toContain('shape = 25')
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
  // pileup reads the mate-derived orientation columns from read_bam, which
  // classifies them with pair_orientation (pulled in as a helper dependency)
  expect(
    resolveHelpers(
      alignmentsFragments({ ...base, colorBy: 'pairOrientation' })[1]!.helpers,
    ),
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
    'bam_modifications(bam, chrom, start, end, min_prob)',
  )
  expect(pileup!.plotExpr).toContain('mod_colors(mods$modtype)')
  expect(pileup!.plotExpr).toContain('reads$row[mods$read_index]')
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
  expect(pileup!.plotExpr).toContain('bam_base_quality(bam, chrom, start, end)')
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
    'pileup_layout(reads)',
  )
  expect(flat!.plotExpr).not.toContain('link_reads')

  // linkReads: group by read name into chains + draw gap connectors
  const [, linked] = alignmentsFragments({ ...base, linkReads: true })
  expect(linked!.helpers).toContain('link_reads')
  expect(linked!.helpers).not.toContain('pileup_layout')
  expect(linked!.plotExpr).toContain(
    'link_reads(reads)',
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
  expect(pileup!.plotExpr).toContain('bam_clips(bam, chrom, start, end)')
  // vertical bars joined to the read's row, colored by clip type, via a color
  // (not fill) identity scale so they compose with the read/mismatch fill scale
  expect(pileup!.plotExpr).toContain('clips$row <- reads$row[clips$read_index]')
  expect(pileup!.plotExpr).toContain('clip_colors[clips$type]')
  expect(pileup!.plotExpr).toContain('scale_color_identity()')
  // clip bars are orthogonal to color scheme — drawn under modifications too
  expect(
    alignmentsFragments({ ...base, colorBy: 'modifications' })[1]!.plotExpr,
  ).toContain('bam_clips(bam, chrom, start, end)')
})

test('pileup marks CIGAR deletions/skips/insertions', () => {
  const [, pileup] = alignmentsFragments(base)
  expect(pileup!.helpers).toEqual(
    expect.arrayContaining(['bam_indels', 'gap_colors']),
  )
  expect(pileup!.plotExpr).toContain('bam_indels(bam, chrom, start, end)')
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
    pileup!.plotExpr.indexOf('bam_mismatches(bam'),
  )
  // orthogonal to color scheme — drawn under modifications too
  expect(
    alignmentsFragments({ ...base, colorBy: 'modifications' })[1]!.plotExpr,
  ).toContain('bam_indels(bam, chrom, start, end)')
})

test('sortedBy reorders the pileup with sorted_pileup_layout', () => {
  // no sort -> plain pileup_layout
  const [, plain] = alignmentsFragments(base)
  expect(plain!.helpers).toContain('pileup_layout')
  expect(plain!.helpers).not.toContain('sorted_pileup_layout')

  // position / strand sorts thread the type + baked center-line column
  const [, byPos] = alignmentsFragments({
    ...base,
    sortType: 'position',
    sortPos: 4200,
  })
  expect(byPos!.helpers).toContain('sorted_pileup_layout')
  expect(byPos!.helpers).not.toContain('pileup_layout')
  expect(byPos!.plotExpr).toContain('sort_pos <- 4200')
  expect(byPos!.plotExpr).toContain(
    'sorted_pileup_layout(reads, sort_pos, "position")',
  )

  const [, byStrand] = alignmentsFragments({
    ...base,
    sortType: 'strand',
    sortPos: 4200,
  })
  expect(byStrand!.plotExpr).toContain(
    'sorted_pileup_layout(reads, sort_pos, "strand")',
  )
})

test('base sort feeds the MD-tag mismatch base at sort_pos into the layout', () => {
  const [, byBase] = alignmentsFragments({
    ...base,
    sortType: 'base',
    sortPos: 4200,
  })
  // base sort needs bam_mismatches even under a scheme that wouldn't pull it in
  expect(byBase!.helpers).toEqual(
    expect.arrayContaining(['sorted_pileup_layout', 'bam_mismatches']),
  )
  expect(byBase!.plotExpr).toContain(
    'sorted_pileup_layout(reads, sort_pos, "base",',
  )
  // feeds both the mismatch base and the CIGAR deletions at sort_pos: JBrowse
  // sorts a deletion as '*', ahead of the ACGT bases
  expect(byBase!.plotExpr).toContain('bam_mismatches(bam, chrom, start, end)')
  expect(byBase!.plotExpr).toContain('bam_indels(bam, chrom, start, end)')
  // base sort feeds the combined mismatch + indel frames into the layout call
  expect(byBase!.plotExpr).toContain(
    'sorted_pileup_layout(reads, sort_pos, "base", mm, indels)',
  )

  // base sort under the modifications scheme (which greys bodies) still sorts
  const [, modsBase] = alignmentsFragments({
    ...base,
    colorBy: 'modifications',
    sortType: 'base',
    sortPos: 4200,
  })
  expect(modsBase!.helpers).toContain('bam_mismatches')
})

test('linkReads (chain layout) suppresses the position sort', () => {
  // chain layout packs whole templates, so a per-read localized sort doesn't apply
  const [, linked] = alignmentsFragments({
    ...base,
    linkReads: true,
    sortType: 'position',
    sortPos: 4200,
  })
  expect(linked!.helpers).toContain('link_reads')
  expect(linked!.helpers).not.toContain('sorted_pileup_layout')
  expect(linked!.plotExpr).not.toContain('sort_pos')
})

test('pileup applies the JBrowse "Filter by" via read_filter', () => {
  // defaults: flag include 0 / exclude 1540, no name, no tag filters
  const [, def] = alignmentsFragments(base)
  expect(def!.helpers).toContain('read_filter')
  expect(def!.plotExpr).toContain('flag_include <- 0')
  expect(def!.plotExpr).toContain('flag_exclude <- 1540')
  expect(def!.plotExpr).toContain('read_name <- NULL')
  expect(def!.plotExpr).toContain('tag_filters <- list()')
  expect(def!.plotExpr).toContain(
    'reads <- read_filter(read_bam(bam, chrom, start, end), bam, chrom, start, end,',
  )
  // the layout runs on the filtered reads, not a fresh read_bam
  expect(def!.plotExpr).toContain('pileup_layout(reads)')

  // explicit flags + read name + tag filters thread through
  const [, filtered] = alignmentsFragments({
    ...base,
    filterFlagInclude: 2,
    filterFlagExclude: 1796,
    filterReadName: 'read123',
    filterTagFilters: [{ tag: 'HP', value: '1' }, { tag: 'RG' }],
  })
  expect(filtered!.plotExpr).toContain('flag_include <- 2')
  expect(filtered!.plotExpr).toContain('flag_exclude <- 1796')
  expect(filtered!.plotExpr).toContain('read_name <- "read123"')
  // a value-less tag filter becomes "*" (has-the-tag)
  expect(filtered!.plotExpr).toContain(
    'tag_filters <- list(list(tag = "HP", value = "1"), list(tag = "RG", value = "*"))',
  )
})

test('low-frequency fade lives on the pileup, not the coverage panel', () => {
  // JBrowse's coverage panel always shows every mismatch fraction; it must not
  // threshold (that was inverted — the fade belongs on the pileup ticks)
  const [cov, pileup] = alignmentsFragments({ ...base, bpPerPx: 5 })
  expect(resolveHelpers(cov!.helpers)).not.toContain('snp_freq_threshold')
  expect(cov!.plotExpr).not.toContain('snp_freq_threshold')
  expect(cov!.plotExpr).not.toContain('show_low_freq')

  // the pileup fades ticks below snp_freq_threshold(depth) once zoomed out past
  // 1 bp/px, with the filter on by default (showLowFreqMismatches false).
  // snp_freq_threshold arrives as a dependency of mismatch_fade_alpha.
  expect([...resolveHelpers(pileup!.helpers)]).toEqual(
    expect.arrayContaining([
      'snp_freq_threshold',
      'bam_coverage',
      'mismatch_fade_alpha',
    ]),
  )
  expect(pileup!.plotExpr).toContain('filter_low_freq <- TRUE')
  expect(pileup!.plotExpr).toContain('bp_per_px <- 5')
  expect(pileup!.plotExpr).toContain('filter_low_freq && bp_per_px > 1')
  expect(pileup!.plotExpr).toContain('mismatch_fade_alpha(mm$refpos, mm$base,')

  // showLowFreqMismatches turns the fade off (every tick opaque)
  const [, keepAll] = alignmentsFragments({
    ...base,
    bpPerPx: 5,
    showLowFreqMismatches: true,
  })
  expect(keepAll!.plotExpr).toContain('filter_low_freq <- FALSE')
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
