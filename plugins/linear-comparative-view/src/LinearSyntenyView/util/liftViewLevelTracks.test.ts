import { liftViewLevelTracks } from './liftViewLevelTracks.ts'

const built = { type: 'SyntenyTrack', configuration: 'vol_synteny' }

test('built tracks on the view become level 0', () => {
  expect(
    liftViewLevelTracks({ type: 'LinearSyntenyView', tracks: [built] }),
  ).toEqual({
    type: 'LinearSyntenyView',
    levels: [{ level: 0, tracks: [built] }],
  })
})

test('recipes stay behind for the launcher', () => {
  expect(
    liftViewLevelTracks({ tracks: [built, 'a_track', { trackId: 'b_track' }] }),
  ).toEqual({
    tracks: ['a_track', { trackId: 'b_track' }],
    levels: [{ level: 0, tracks: [built] }],
  })
})

test('a snapshot that already has levels is left alone', () => {
  const snap = { levels: [{ level: 0, tracks: [] }], tracks: [built] }
  expect(liftViewLevelTracks(snap)).toBe(snap)
})

test('recipes alone and per-level recipe lists are left alone', () => {
  const flat = { tracks: ['a_track'] }
  const nested = { tracks: [['a_track'], [{ trackId: 'b_track' }]] }
  expect(liftViewLevelTracks(flat)).toBe(flat)
  expect(liftViewLevelTracks(nested)).toBe(nested)
})
