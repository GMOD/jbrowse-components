import { seedDisplayDefaults } from './displayDefaults.ts'

const track = { type: 'MultiQuantitativeTrack', trackId: 't' }

test('a track naming no display setting gets the whole set', () => {
  expect(seedDisplayDefaults(track).displayDefaults).toEqual({
    facet: 'source',
    summaryScoreMode: 'avg',
    height: 200,
  })
})

test('a key the config spells in displayDefaults wins', () => {
  const snap = { ...track, displayDefaults: { facet: '', height: 90 } }
  expect(seedDisplayDefaults(snap).displayDefaults).toEqual({
    facet: '',
    summaryScoreMode: 'avg',
    height: 90,
  })
})

// The shorthand expands after this runs, so a key written on the display entry
// itself has to count as spelled here or the seed would fight it.
test('a key the config spells on the display entry wins', () => {
  const snap = {
    ...track,
    displays: [{ type: 'LinearWiggleDisplay', facet: '' }],
  }
  expect(seedDisplayDefaults(snap).displayDefaults).toEqual({
    summaryScoreMode: 'avg',
    height: 200,
  })
})
