import { refuseFacetShorthand, seedDisplayDefaults } from './displayDefaults.ts'

const track = { type: 'MultiQuantitativeTrack', trackId: 't' }

describe('displayDefaults.facet on a quantitative track', () => {
  const quantitative = { type: 'QuantitativeTrack', trackId: 'q' }

  // The mark display still declares `facet`, so the shorthand router would
  // otherwise send the key there in silence and open the track as a mark
  // display; on the quantitative display's own entry it meets `checkRowsField`.
  it('lands on an explicit quantitative-display entry', () => {
    expect(
      refuseFacetShorthand({
        ...quantitative,
        displayDefaults: { facet: 'source', height: 90 },
      }),
    ).toEqual({
      ...quantitative,
      displayDefaults: { height: 90 },
      displays: [
        {
          type: 'LinearWiggleDisplay',
          displayId: 'q-LinearWiggleDisplay',
          facet: 'source',
        },
      ],
    })
  })

  it('joins an entry the config already spells', () => {
    expect(
      refuseFacetShorthand({
        ...quantitative,
        displayDefaults: { facet: '' },
        displays: [{ type: 'LinearWiggleDisplay', displayId: 'w', height: 50 }],
      }).displays,
    ).toEqual([
      { type: 'LinearWiggleDisplay', displayId: 'w', height: 50, facet: '' },
    ])
  })

  it('leaves a track spelling rows alone', () => {
    const snap = { ...quantitative, displayDefaults: { rows: 'source' } }
    expect(refuseFacetShorthand(snap)).toBe(snap)
  })
})

test('a track naming no display setting gets the whole set', () => {
  expect(seedDisplayDefaults(track).displayDefaults).toEqual({
    rows: 'source',
    summaryScoreMode: 'avg',
    height: 200,
  })
})

test('a key the config spells in displayDefaults wins', () => {
  const snap = { ...track, displayDefaults: { rows: '', height: 90 } }
  expect(seedDisplayDefaults(snap).displayDefaults).toEqual({
    rows: '',
    summaryScoreMode: 'avg',
    height: 90,
  })
})

// The shorthand expands after this runs, so a key written on the display entry
// itself has to count as spelled here or the seed would fight it.
test('a key the config spells on the display entry wins', () => {
  const snap = {
    ...track,
    displays: [{ type: 'LinearWiggleDisplay', rows: '' }],
  }
  expect(seedDisplayDefaults(snap).displayDefaults).toEqual({
    summaryScoreMode: 'avg',
    height: 200,
  })
})
