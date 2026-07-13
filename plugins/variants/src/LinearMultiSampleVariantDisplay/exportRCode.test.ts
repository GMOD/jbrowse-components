import { variantRowFragment } from './exportRCode.ts'

import type { VariantRowRParams } from './exportRCode.ts'

const base: VariantRowRParams = {
  trackId: 'variants',
  trackName: '1000 Genomes',
  uri: 'https://example.com/panel.vcf.gz',
  minMaf: 0,
  maxMissing: 1,
  phased: false,
}

test('reads genotypes with read_vcf_gt and emits no bespoke package', () => {
  const f = variantRowFragment(base)
  expect(f.plotVariable).toBe('p_variants')
  expect(f.helpers).toEqual(['read_vcf_gt', 'bp_axis'])
  expect(f.packages).toEqual(['Rsamtools', 'GenomicRanges', 'ggplot2'])
  expect(f.packages).not.toContain('VariantAnnotation')
  // no patchwork / dendrogram — this is a plain 1-D panel, not the matrix
  expect(f.packages).not.toContain('patchwork')
  expect(f.plotExpr).toContain('read_vcf_gt(variants, chrom, start, end, FALSE)')
  expect(f.plotExpr).not.toContain('dendro_segments')
})

test('phased mode reads per-haplotype genotypes and uses the phased palette', () => {
  const f = variantRowFragment({ ...base, phased: true })
  expect(f.plotExpr).toContain('read_vcf_gt(variants, chrom, start, end, TRUE)')
  expect(f.plotExpr).toContain('levels = c("ref", "alt", "other", "nocall")')
  expect(f.plotExpr).toContain('alt = "#377eb8"')
  expect(f.plotExpr).not.toContain('het = "#6699cc"')
})

test('draws one genotype row per sample at genomic position', () => {
  const f = variantRowFragment(base)
  expect(f.plotExpr).toContain('geom_rect(aes(xmin = xmin, xmax = xmax')
  // genomic x, so it shares the coord_cartesian(xlim=) contract with 1-D tracks
  expect(f.plotExpr).toContain('coord_cartesian(xlim = c(start, end))')
  expect(f.plotExpr).toContain('bp_axis()')
  expect(f.plotExpr).toContain('vstart <- gt$start[keep]; vend <- gt$end[keep]')
  expect(f.plotExpr).toContain('scale_fill_manual')
})

test('emits editable MAF / missingness threshold variables from the slots', () => {
  const f = variantRowFragment({ ...base, minMaf: 0.05, maxMissing: 0.2 })
  expect(f.setup).toContain('variants_min_maf <- 0.05')
  expect(f.setup).toContain('variants_max_missing <- 0.2')
  expect(f.plotExpr).toContain('gt$maf >= variants_min_maf')
  expect(f.plotExpr).toContain('gt$missingness <= variants_max_missing')
})

test('non-identifier track ids become safe R variable names', () => {
  const f = variantRowFragment({ ...base, trackId: '1000g.panel' })
  expect(f.plotVariable).toBe('p__1000g_panel')
  expect(f.setup).toContain('_1000g_panel <- "https://example.com/panel.vcf.gz"')
})
