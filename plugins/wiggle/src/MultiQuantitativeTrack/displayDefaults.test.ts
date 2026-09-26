import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import WigglePlugin from '../index.ts'
import { wiggleEntryShorthand } from './displayDefaults.ts'

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

function threeSlots(snap: Record<string, unknown>) {
  const track = loadTrack(snap)
  const [display] = track.displays
  return {
    track,
    slots: {
      rows: readConfObject(display, ['rows', 'field']),
      height: readConfObject(display, 'height'),
      summaryScoreMode: readConfObject(display, 'summaryScoreMode'),
    },
  }
}

test('a MultiQuantitativeTrack reads a row per source, averaged, 200px', () => {
  const { track, slots } = threeSlots({ type: 'MultiQuantitativeTrack' })
  expect(slots).toEqual({
    rows: 'source',
    height: 200,
    summaryScoreMode: 'avg',
  })
  expect(getSnapshot(track).displays).toEqual([
    { type: 'LinearWiggleDisplay', displayId: 't-LinearWiggleDisplay' },
  ])
})

test('a QuantitativeTrack reads one plot box, whiskers, 100px', () => {
  expect(threeSlots({ type: 'QuantitativeTrack' }).slots).toEqual({
    rows: '',
    height: 100,
    summaryScoreMode: 'whiskers',
  })
})

// The single-source values are not this track's defaults, so the snapshot
// keeps them and a reload reads them back.
test('the single-source values survive two round trips', () => {
  const explicit = { rows: '', height: 100, summaryScoreMode: 'whiskers' }
  let snap: Record<string, unknown> = {
    type: 'MultiQuantitativeTrack',
    displays: [{ type: 'LinearWiggleDisplay', displayId: 'w', ...explicit }],
  }
  for (let i = 0; i < 2; i++) {
    const { track, slots } = threeSlots(snap)
    expect(slots).toEqual(explicit)
    snap = getSnapshot(track) as Record<string, unknown>
  }
})

test.each(['QuantitativeTrack', 'MultiQuantitativeTrack'])(
  'a %s with rows on another field fails to load for the quantitative display',
  type => {
    expect(() =>
      loadTrack({ type, displayDefaults: { rows: 'group' } }),
    ).toThrow(/a quantitative display puts "source" alone on rows/)
  },
)
