import { variantMatrixFragment } from './exportRCode.ts'

import type { VariantMatrixRParams } from './exportRCode.ts'

const base: VariantMatrixRParams = {
  trackId: 'variants',
  trackName: '1000 Genomes',
  uri: 'https://example.com/panel.vcf.gz',
  minMaf: 0,
  maxMissing: 1,
}

test('reads genotypes with read_vcf_gt and emits no bespoke package', () => {
  const f = variantMatrixFragment(base)
  expect(f.plotVariable).toBe('p_variants')
  expect(f.helpers).toEqual(['read_vcf_gt', 'dendro_segments'])
  // Rsamtools scanTabix path — no VariantAnnotation dependency
  expect(f.packages).toEqual([
    'Rsamtools',
    'GenomicRanges',
    'ggplot2',
    'patchwork',
  ])
  expect(f.packages).not.toContain('VariantAnnotation')
  expect(f.plotExpr).toContain('read_vcf_gt(variants, chrom, start, end)')
})

test('draws a geom_tile matrix clustered by hclust with a dendrogram panel', () => {
  const f = variantMatrixFragment(base)
  expect(f.plotExpr).toContain('geom_tile()')
  expect(f.plotExpr).toContain('hclust(dist(t(replace(dose, is.na(dose), 0))))')
  expect(f.plotExpr).toContain('dendro_segments(hc)')
  expect(f.plotExpr).toContain('scale_fill_manual')
})

test('emits editable MAF / missingness threshold variables from the slots', () => {
  const f = variantMatrixFragment({ ...base, minMaf: 0.05, maxMissing: 0.2 })
  expect(f.setup).toContain('variants_min_maf <- 0.05')
  expect(f.setup).toContain('variants_max_missing <- 0.2')
  expect(f.plotExpr).toContain('gt$maf >= variants_min_maf')
  expect(f.plotExpr).toContain('gt$missingness <= variants_max_missing')
})

test('non-identifier track ids become safe R variable names', () => {
  const f = variantMatrixFragment({ ...base, trackId: '1000g.panel' })
  expect(f.plotVariable).toBe('p__1000g_panel')
  expect(f.setup).toContain('_1000g_panel <- "https://example.com/panel.vcf.gz"')
})
