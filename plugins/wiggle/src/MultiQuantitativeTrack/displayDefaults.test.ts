import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import WigglePlugin from '../index.ts'
import { seedDisplayDefaults, wiggleEntryShorthand } from './displayDefaults.ts'

const track = { type: 'MultiQuantitativeTrack', trackId: 't' }

describe('displayDefaults.facet on a quantitative track', () => {
  const quantitative = { type: 'QuantitativeTrack', trackId: 'q' }

  // The mark display still declares `facet`, so the shorthand router would
  // otherwise send the key there in silence and open the track as a mark
  // display; on the quantitative display's own entry it meets `checkRowsField`.
  it('lands on an explicit quantitative-display entry', () => {
    expect(
      wiggleEntryShorthand({
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
      wiggleEntryShorthand({
        ...quantitative,
        displayDefaults: { facet: '' },
        displays: [{ type: 'LinearWiggleDisplay', displayId: 'w', height: 50 }],
      }).displays,
    ).toEqual([
      { type: 'LinearWiggleDisplay', displayId: 'w', height: 50, facet: '' },
    ])
  })
})

describe('displayDefaults.rows on a quantitative track', () => {
  const quantitative = { type: 'QuantitativeTrack', trackId: 'q' }

  it('lands on the quantitative-display entry alone', () => {
    expect(
      wiggleEntryShorthand({
        ...quantitative,
        displayDefaults: { rows: 'source', height: 90 },
        displays: [{ type: 'LinearMarkDisplay', displayId: 'm', facet: 'HP' }],
      }),
    ).toEqual({
      ...quantitative,
      displayDefaults: { height: 90 },
      displays: [
        { type: 'LinearMarkDisplay', displayId: 'm', facet: 'HP' },
        {
          type: 'LinearWiggleDisplay',
          displayId: 'q-LinearWiggleDisplay',
          rows: 'source',
        },
      ],
    })
  })

  it('leaves an entry spelling its own rows as it is', () => {
    expect(
      wiggleEntryShorthand({
        ...quantitative,
        displayDefaults: { rows: 'source' },
        displays: [{ type: 'LinearWiggleDisplay', displayId: 'w', rows: '' }],
      }).displays,
    ).toEqual([{ type: 'LinearWiggleDisplay', displayId: 'w', rows: '' }])
  })
})

function loadTrack(snap: Record<string, unknown>) {
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new WigglePlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager.pluggableConfigSchemaType('track').create(
    {
      trackId: 't',
      assemblyNames: ['volvox'],
      adapter: { type: 'BigWigAdapter', uri: 'a.bw' },
      ...snap,
    },
    { pluginManager },
  )
}

test('a MultiQuantitativeTrack seeds rows onto the quantitative display alone', () => {
  const { displays } = getSnapshot(
    loadTrack({ type: 'MultiQuantitativeTrack' }),
  ) as { displays: Record<string, unknown>[] }
  expect(displays).toEqual([
    {
      type: 'LinearWiggleDisplay',
      displayId: 't-LinearWiggleDisplay',
      rows: { field: 'source' },
      summaryScoreMode: 'avg',
      height: 200,
    },
  ])
})

test.each(['QuantitativeTrack', 'MultiQuantitativeTrack'])(
  'a %s with rows on another field fails to load for the quantitative display',
  type => {
    expect(() =>
      loadTrack({ type, displayDefaults: { rows: 'group' } }),
    ).toThrow(/a quantitative display puts "source" alone on rows/)
  },
)

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
