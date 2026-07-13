import { hicFragment } from './exportRCode.ts'

const params = {
  trackId: 'hic-track',
  trackName: 'Hi-C',
  uri: 'https://example.com/contacts.hic',
  binsize: 100000,
  norm: 'KR',
  useLogScale: true,
}

test('emits a strawr-backed rotated triangular contact map fragment', () => {
  const f = hicFragment(params)
  expect(f.packages).toContain('strawr')
  expect(f.helpers).toEqual(['hic_triangle', 'bp_axis'])
  expect(f.plotExpr).toContain('geom_polygon')
  expect(f.plotExpr).toContain('hic_triangle')
  expect(f.plotExpr).toContain('coord_cartesian(xlim = c(start, end))')
  // binsize + norm are visible, editable script variables (not inlined literals)
  expect(f.setup).toContain('hic_track_binsize <- 100000')
  expect(f.setup).toContain('hic_track_norm <- "KR"')
  expect(f.plotExpr).toContain('hic_track_binsize')
  expect(f.plotExpr).toContain('hic_track_norm')
})

test('useLogScale picks the fill transform', () => {
  expect(hicFragment(params).plotExpr).toContain('trans = "log1p"')
  expect(hicFragment({ ...params, useLogScale: false }).plotExpr).toContain(
    'trans = "identity"',
  )
})

test('sanitizes a track id that is not a valid R name', () => {
  const f = hicFragment({ ...params, trackId: '123 my.hic' })
  expect(f.setup).toContain('_123_my_hic <-')
  expect(f.plotVariable).toBe('p__123_my_hic')
})
