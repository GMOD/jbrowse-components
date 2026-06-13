import { makeTrackId } from './makeTrackId.ts'

test('slugifies, trims, admin mode has no session suffix', () => {
  expect(makeTrackId({ name: '  My Track  ', adminMode: true })).toMatch(
    /^my_track-\d+$/,
  )
})

test('non-admin appends sessionTrack suffix', () => {
  expect(makeTrackId({ name: 'x', adminMode: false })).toMatch(
    /^x-\d+-sessionTrack$/,
  )
})

test('pinned timestamp and index disambiguate a batch', () => {
  expect(
    makeTrackId({ name: 'My Track', adminMode: true, timestamp: 42, index: 3 }),
  ).toBe('my_track-42-3')
  expect(
    makeTrackId({ name: 'My Track', adminMode: false, timestamp: 42, index: 3 }),
  ).toBe('my_track-42-3-sessionTrack')
})
