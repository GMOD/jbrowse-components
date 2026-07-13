import { variantFragment } from './exportRCode.ts'

import type { VariantRParams } from './exportRCode.ts'

const base: VariantRParams = {
  trackId: 'variants',
  trackName: 'Volvox variants',
  uri: 'https://example.com/volvox.vcf.gz',
}

test('reads the VCF with read_vcf and emits no bespoke package', () => {
  const f = variantFragment(base)
  expect(f.plotVariable).toBe('p_variants')
  expect(f.setup).toBe('variants <- "https://example.com/volvox.vcf.gz"')
  expect(f.helpers).toEqual(['read_vcf', 'vcf_layout', 'bp_axis'])
  // Rsamtools scanTabix path — no VariantAnnotation dependency
  expect(f.packages).toEqual(['Rsamtools', 'GenomicRanges', 'ggplot2'])
  expect(f.packages).not.toContain('VariantAnnotation')
  expect(f.plotExpr).toContain(
    'vcf_layout(read_vcf(variants, chrom, start, end))',
  )
  expect(f.plotExpr).not.toMatch(/jb_features|geom_variant|scale_x_genomic/)
})

test('draws a colored span with a lollipop head, keyed on variant type', () => {
  const f = variantFragment(base)
  expect(f.plotExpr).toContain(
    'geom_segment(aes(x = start, xend = end, y = row, yend = row, color = type)',
  )
  expect(f.plotExpr).toContain(
    'geom_point(aes(x = (start + end) / 2, y = row, color = type)',
  )
  expect(f.plotExpr).toContain('scale_y_reverse()')
  expect(f.plotExpr).toContain('color = "Type"')
})

test('non-identifier track ids become safe R variable names', () => {
  const f = variantFragment({ ...base, trackId: '1000g.snv-calls' })
  expect(f.plotVariable).toBe('p__1000g_snv_calls')
  expect(f.setup).toBe('_1000g_snv_calls <- "https://example.com/volvox.vcf.gz"')
})
