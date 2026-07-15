import { makeTrackId } from './makeTrackId.ts'

test('slugifies and trims', () => {
  expect(makeTrackId({ name: '  My Track  ' })).toMatch(/^my_track-\d+$/)
})

test('pinned timestamp and index disambiguate a batch', () => {
  expect(makeTrackId({ name: 'My Track', timestamp: 42, index: 3 })).toBe(
    'my_track-42-3',
  )
})
