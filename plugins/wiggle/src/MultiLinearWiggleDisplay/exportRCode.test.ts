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
  heightPx: 120,
}

test('reads sources with read_multibigwig and emits no bespoke package', () => {
  const f = multiWiggleFragment(base)
  expect(f.plotVariable).toBe('p_multicov')
  // read_bigwig is not declared here: assembleRScript pulls it in as a
  // dependency of read_multibigwig
  expect(f.helpers).toEqual(['read_multibigwig'])
  expect(f.packages).toEqual(['rtracklayer', 'ggplot2'])
  expect(f.plotExpr).toContain(
    'read_regions(function(chrom, start, end) read_multibigwig(multicov_uris, multicov_names, chrom, start, end), regions, c("start", "end"))',
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
  expect(f.plotExpr).toContain(
    'geom_area(aes(x = start, y = score, fill = source, group = interaction(source, .region))',
  )
  expect(f.plotExpr).toContain(
    'scale_fill_manual(values = c(`Alpha` = "#e6194b", `Beta` = "#3cb44b"), guide = "none")',
  )
  // the panel's height comes from the DISPLAY's height, not the source count
  expect(f.heightWeight).toBe(2)
})

test('overlay XY keeps one panel, a source legend, and overlaps with alpha', () => {
  const f = multiWiggleFragment({
    ...base,
    renderingType: 'multixyplot',
    isOverlay: true,
  })
  expect(f.plotExpr).not.toContain('facet_grid')
  expect(f.plotExpr).toContain('position = "identity", alpha = 0.4')
  expect(f.plotExpr).toContain('scale_fill_manual(values = ')
  expect(f.plotExpr).toContain('name = NULL')
  expect(f.heightWeight).toBe(2)
})

test('overlay line uses geom_step + color aesthetic', () => {
  const f = multiWiggleFragment({
    ...base,
    renderingType: 'multiline',
    isOverlay: true,
  })
  expect(f.plotExpr).toContain(
    'geom_step(aes(x = start, y = score, color = source, group = interaction(source, .region)))',
  )
  expect(f.plotExpr).toContain('scale_color_manual(values = ')
})

test('interpolated line uses geom_line (linecenter tested before line)', () => {
  const f = multiWiggleFragment({
    ...base,
    renderingType: 'multirowlinecenter',
  })
  expect(f.plotExpr).toContain(
    'geom_line(aes(x = start, y = score, color = source, group = interaction(source, .region)))',
  )
})

test('scatter uses geom_point', () => {
  const f = multiWiggleFragment({ ...base, renderingType: 'multirowscatter' })
  expect(f.plotExpr).toContain(
    'geom_point(aes(x = start, y = score, color = source)',
  )
})

// One continuous y axis rather than a facet per source: each density facet is a
// bare 0..1 strip, so faceting buys nothing and cannot scale — and the
// continuous axis is what lets the rows compress and overplot the way the
// browser's fit-to-height display does.
test('density stacks sources on one continuous axis, in display order', () => {
  const f = multiWiggleFragment({ ...base, renderingType: 'multirowdensity' })
  expect(f.plotExpr).toContain('fill = score')
  expect(f.plotExpr).toContain('scale_fill_viridis_c()')
  expect(f.plotExpr).not.toContain('facet_grid')
  // match() against the name vector keeps the display's own row order, where a
  // ggplot factor would sort them alphabetically
  expect(f.plotExpr).toContain('ymin = match(source, multicov_names) - 1L')
  // few enough rows to label
  expect(f.plotExpr).toContain('labels = multicov_names')
})

// A row pitch under ~10px is a label nobody can read, and 2504 of them is a
// panel made of text. This is the case the browser handles by overplotting.
test('density drops the per-source labels once the rows are too thin', () => {
  const sources = Array.from({ length: 2504 }, (_, i) => ({
    name: `S${i}`,
    uri: `s${i}.bw`,
    color: '#000000',
  }))
  const f = multiWiggleFragment({
    ...base,
    renderingType: 'multirowdensity',
    sources,
    heightPx: 420,
  })
  expect(f.plotExpr).not.toContain('labels = multicov_names')
  expect(f.plotExpr).toContain('axis.text.y = element_blank()')
  // and the panel asks for the display's height, not 2504 rows' worth
  expect(f.heightWeight).toBe(7)
})

test('non-identifier track ids become safe R variable names', () => {
  const f = multiWiggleFragment({ ...base, trackId: '1000g.multi-cov' })
  // a letter, not `_`: R rejects a leading underscore exactly as it rejects the
  // leading digit, so the guard has to prefix something parseable
  expect(f.plotVariable).toBe('p_x1000g_multi_cov')
  expect(f.setup).toContain('x1000g_multi_cov_uris <- c(')
})
