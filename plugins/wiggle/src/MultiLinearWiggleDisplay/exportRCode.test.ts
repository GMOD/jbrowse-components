import { multiWiggleFragment } from './exportRCode.ts'

import type { MultiWiggleRParams } from './exportRCode.ts'

const base: MultiWiggleRParams = {
  trackId: 'multicov',
  trackName: 'Multi coverage',
  sources: [
    { name: 'Alpha', uri: 'https://example.com/a.bw', color: '#e6194b' },
    { name: 'Beta', uri: 'https://example.com/b.bw', color: '#3cb44b' },
  ],
  renderingType: 'multirowxy',
  isOverlay: false,
}

test('reads sources with read_multibigwig and emits no bespoke package', () => {
  const f = multiWiggleFragment(base)
  expect(f.plotVariable).toBe('p_multicov')
  expect(f.helpers).toEqual(['read_bigwig', 'read_multibigwig', 'bp_axis'])
  expect(f.packages).toEqual(['rtracklayer', 'ggplot2'])
  expect(f.plotExpr).toContain(
    'read_multibigwig(multicov_uris, multicov_names, chrom, start, end)',
  )
  expect(f.plotExpr).not.toMatch(/jb_features|geom_wiggle|scale_x_genomic/)
})

test('setup emits parallel uri + name vectors in source order', () => {
  const f = multiWiggleFragment(base)
  expect(f.setup).toBe(
    'multicov_uris <- c("https://example.com/a.bw", "https://example.com/b.bw")\n' +
      'multicov_names <- c("Alpha", "Beta")',
  )
})

test('multi-row XY facets by source and colors rows by the source palette', () => {
  const f = multiWiggleFragment(base)
  expect(f.plotExpr).toContain('facet_grid(rows = vars(source))')
  expect(f.plotExpr).toContain('geom_area(aes(x = start, y = score, fill = source)')
  expect(f.plotExpr).toContain(
    'scale_fill_manual(values = c(`Alpha` = "#e6194b", `Beta` = "#3cb44b"), guide = "none")',
  )
  // one row per source
  expect(f.heightWeight).toBe(2)
})

test('overlay XY keeps one panel, a source legend, and overlaps with alpha', () => {
  const f = multiWiggleFragment({ ...base, renderingType: 'multixyplot', isOverlay: true })
  expect(f.plotExpr).not.toContain('facet_grid')
  expect(f.plotExpr).toContain('position = "identity", alpha = 0.4')
  expect(f.plotExpr).toContain('scale_fill_manual(values = ')
  expect(f.plotExpr).toContain('name = NULL')
  expect(f.heightWeight).toBe(2)
})

test('overlay line uses geom_step + color aesthetic', () => {
  const f = multiWiggleFragment({ ...base, renderingType: 'multiline', isOverlay: true })
  expect(f.plotExpr).toContain('geom_step(aes(x = start, y = score, color = source))')
  expect(f.plotExpr).toContain('scale_color_manual(values = ')
})

test('interpolated line uses geom_line (linecenter tested before line)', () => {
  const f = multiWiggleFragment({
    ...base,
    renderingType: 'multirowlinecenter',
  })
  expect(f.plotExpr).toContain('geom_line(aes(x = start, y = score, color = source))')
})

test('scatter uses geom_point', () => {
  const f = multiWiggleFragment({ ...base, renderingType: 'multirowscatter' })
  expect(f.plotExpr).toContain('geom_point(aes(x = start, y = score, color = source)')
})

test('density is a faceted viridis strip keyed on score, y axis hidden', () => {
  const f = multiWiggleFragment({ ...base, renderingType: 'multirowdensity' })
  expect(f.plotExpr).toContain('fill = score')
  expect(f.plotExpr).toContain('scale_fill_viridis_c()')
  expect(f.plotExpr).toContain('facet_grid(rows = vars(source))')
  expect(f.plotExpr).toContain('axis.text.y = element_blank()')
})

test('non-identifier track ids become safe R variable names', () => {
  const f = multiWiggleFragment({ ...base, trackId: '1000g.multi-cov' })
  expect(f.plotVariable).toBe('p__1000g_multi_cov')
  expect(f.setup).toContain('_1000g_multi_cov_uris <- c(')
})
