import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

import { trackTableModelFactory } from '../TrackTable/trackTableModel.ts'

import type { HierarchicalTrackSelectorModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
        ],
      },
    },
  })
  for (const conf of [
    { trackId: 'plain', name: 'plain', description: 'chromatin marks' },
    { trackId: 'markup', name: '<i>italic</i> track', description: '' },
    { trackId: 'categorized', name: 'categorized', category: ['assays'] },
  ]) {
    session.addSessionTrackConf({
      ...conf,
      assemblyNames: ['volMyt1'],
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
  }
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  return {
    session,
    model: view.activateTrackSelector() as HierarchicalTrackSelectorModel,
  }
}

function treeMatches(model: HierarchicalTrackSelectorModel, query: string) {
  model.setFilterText(query)
  return model.rows
    .flatMap(({ item }) => (item.type === 'track' ? [item.trackId] : []))
    .toSorted()
}

// the description is on screen as the row's tooltip, so a query for text the
// user can see there has to find the track
test('the tree filter matches a track description', () => {
  const { model } = setup()
  expect(treeMatches(model, 'chromatin')).toEqual(['plain'])
})

// searching "i" should not hit a track whose name merely contains <i>
test('the tree filter does not match markup in a track name', () => {
  const { model } = setup()
  expect(treeMatches(model, 'italic')).toEqual(['markup'])
  expect(treeMatches(model, '<i>')).toEqual([])
})

test('the tree filter needs every word, in any field and any order', () => {
  const { model } = setup()
  expect(treeMatches(model, 'marks plain')).toEqual(['plain'])
  expect(treeMatches(model, 'marks categorized')).toEqual([])
  expect(treeMatches(model, 'session -assays')).toEqual(['markup', 'plain'])
})

test('the tree counts the tracks a query keeps, of all it lists', () => {
  const { model } = setup()
  expect(model.trackTable.matchCounts).toBeUndefined()
  model.setFilterText('chromatin')
  expect(model.trackTable.matchCounts).toEqual({ matched: 1, total: 4 })
  model.setFilterText('-chromatin')
  expect(model.trackTable.matchCounts).toEqual({ matched: 3, total: 4 })
})

test('the tree filter still matches a category name', () => {
  const { model } = setup()
  expect(treeMatches(model, 'assays')).toEqual(['categorized'])
})

// the folder a non-admin's own tracks nest under is drawn like any other
// category, so it is searchable like any other category. setup() is a non-admin
// session, so addTrackConf put all three under it
test('the tree filter matches the session-tracks category', () => {
  const { model } = setup()
  expect(treeMatches(model, 'session tracks')).toEqual([
    'categorized',
    'markup',
    'plain',
  ])
})

// a query can't span two fields: both filter boxes are single-line, and the
// fields are newline-joined for exactly that reason
test('a query cannot span two fields', () => {
  const { model } = setup()
  expect(treeMatches(model, 'plainchromatin')).toEqual([])
})

// The two selectors search different field sets on purpose — each searches what
// it shows — but they must normalize the same way. This is the case that drifted
// before: the tree matched raw markup while the table grid stripped it.
test('both selectors agree on markup and case normalization', () => {
  const { session, model } = setup()
  const table = trackTableModelFactory().create({})
  table.setTrackSource(
    () => model.allTrackConfigurations,
    getSession(model),
    model.assemblyNames,
  )
  expect(session).toBeTruthy()

  for (const query of ['<i>', 'ITALIC', 'chromatin']) {
    table.setFilterText(query)
    const tableIds = table.rows.map(r => r.id).toSorted()
    expect(treeMatches(model, query)).toEqual(tableIds)
  }
})
