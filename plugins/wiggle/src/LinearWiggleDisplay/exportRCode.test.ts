import { wiggleFragment } from './exportRCode.ts'

import type { WiggleRParams } from './exportRCode.ts'

const base: WiggleRParams = {
  trackId: 'coverage',
  trackName: 'Coverage',
  uri: 'https://example.com/cov.bw',
  isDensity: false,
  isLine: false,
  useBicolor: false,
  color: '#2166ac',
  posColor: 'blue',
  negColor: 'red',
  bicolorPivot: 0,
}

test('emits pure ggplot2 with a read_bigwig data source and no bespoke package', () => {
  const f = wiggleFragment(base)
  expect(f.plotVariable).toBe('p_coverage')
  expect(f.setup).toBe('coverage <- "https://example.com/cov.bw"')
  expect(f.helpers).toEqual(['read_bigwig', 'bp_axis'])
  expect(f.packages).toEqual(['rtracklayer', 'ggplot2'])
  expect(f.plotExpr).toContain('ggplot(read_bigwig(coverage, chrom, start, end))')
  expect(f.plotExpr).toContain('theme_minimal()')
  // never leaks a ggjbrowse concept into the output
  expect(f.plotExpr).not.toMatch(/jb_features|geom_wiggle|scale_x_genomic/)
})

test('solid coverage uses geom_rect with the track color', () => {
  const f = wiggleFragment(base)
  expect(f.plotExpr).toContain(
    'geom_rect(aes(xmin = start, xmax = end, ymin = 0, ymax = score), fill = "#2166ac")',
  )
})

test('line mode uses geom_step', () => {
  const f = wiggleFragment({ ...base, isLine: true })
  expect(f.plotExpr).toContain(
    'geom_step(aes(x = start, y = score), color = "#2166ac")',
  )
})

test('density mode uses geom_rect + viridis and hides the y axis', () => {
  const f = wiggleFragment({ ...base, isDensity: true })
  expect(f.plotExpr).toContain('fill = score')
  expect(f.plotExpr).toContain('scale_fill_viridis_c()')
  expect(f.plotExpr).toContain('axis.text.y = element_blank()')
})

test('bicolor mode maps fill to the sign of the score', () => {
  const f = wiggleFragment({
    ...base,
    useBicolor: true,
    posColor: '#b',
    negColor: '#r',
    bicolorPivot: 5,
  })
  expect(f.plotExpr).toContain(
    'geom_rect(aes(xmin = start, xmax = end, ymin = 0, ymax = score, fill = score >= 5))',
  )
  expect(f.plotExpr).toContain(
    'scale_fill_manual(values = c(`TRUE` = "#b", `FALSE` = "#r"), guide = "none")',
  )
})

test('non-identifier track ids become safe R variable names', () => {
  const f = wiggleFragment({ ...base, trackId: '1000g.cov-track' })
  expect(f.plotVariable).toBe('p__1000g_cov_track')
  expect(f.setup).toBe('_1000g_cov_track <- "https://example.com/cov.bw"')
})
