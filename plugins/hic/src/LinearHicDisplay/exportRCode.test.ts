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
  expect(f.helpers).toEqual(['hic_regions'])
  expect(f.plotExpr).toContain('geom_polygon')
  // the whole regions frame, NOT a read_regions() per-region read: a Hi-C
  // matrix is fetched per PAIR of regions, which is the only way the
  // cross-region contact block a discontiguous view exists to show gets drawn
  expect(f.plotExpr).toContain('hic_regions(hic_track, regions,')
  expect(f.plotExpr).not.toContain('read_regions(')
  expect(f.plotExpr).toContain('group = group')
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

// A LETTER, not the `_` this used to pin: R rejects a leading underscore at
// parse time exactly as it rejects a leading digit, so the old guard turned any
// track id starting with one (`1KGP_3202…`, `1000g_…`) into a whole script that
// would not run.
test('sanitizes a track id that is not a valid R name', () => {
  const f = hicFragment({ ...params, trackId: '123 my.hic' })
  expect(f.setup).toContain('x123_my_hic <-')
  expect(f.plotVariable).toBe('p_x123_my_hic')
})
