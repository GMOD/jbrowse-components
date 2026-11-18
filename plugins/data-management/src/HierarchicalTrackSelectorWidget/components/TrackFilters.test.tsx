import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, render } from '@testing-library/react'
import { when } from 'mobx'

import HierarchicalTrackSelector from './HierarchicalTrackSelector.tsx'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

beforeAll(() => {
  Element.prototype.scrollTo = () => {}
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

const BIOSAMPLE = ['K562', 'K562', 'HepG2', 'HepG2']

function trackConf(i: number) {
  return {
    trackId: `t${i}`,
    name: i % 2 ? `odd${i}` : `even${i}`,
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
    metadata: {
      assay: i < 4 ? 'ChIP' : 'DNase',
      biosample: BIOSAMPLE[i % 4],
    },
  }
}

async function setup({ connectionTracks = [] as number[] } = {}) {
  const session = createTestSession({
    adminMode: true,
    jbrowseConfig: {
      connections: [
        {
          connectionId: 'conn1',
          type: 'JBrowse1Connection',
          name: 'Conn',
          assemblyNames: ['volMyt1'],
        },
      ],
    },
  })
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
  for (let i = 0; i < 8; i++) {
    session.addSessionTrackConf(trackConf(i))
  }
  if (connectionTracks.length) {
    session.makeConnection(session.connections[0]!, {
      tracks: connectionTracks.map(trackConf),
    })
  }
  const { assemblyManager } = session
  await when(
    () =>
      assemblyManager.assemblies.length ===
      assemblyManager.assemblyNamesList.length,
  )
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { queryByRole } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  return {
    model,
    status: () => queryByRole('status')?.textContent,
    filter: (text: string, facets: Record<string, string[]> = {}) => {
      act(() => {
        model.setFilterText(text)
        for (const [key, values] of Object.entries(facets)) {
          model.trackTable.setFilter(key, values)
        }
      })
    },
  }
}

function treeTrackIds(model: HierarchicalTrackSelectorModel) {
  return model.rows.flatMap(({ item }) =>
    item.type === 'track' ? [item.trackId] : [],
  )
}

const K562 = { 'metadata.biosample': ['K562'] }

test('the tree keeps and counts what its own text search keeps', async () => {
  const { model, status, filter } = await setup()
  expect(status()).toBeUndefined()

  filter('even')
  expect(treeTrackIds(model).toSorted()).toEqual(['t0', 't2', 't4', 't6'])
  expect(status()).toBe('4 of 9')

  filter('K562')
  expect(treeTrackIds(model)).toEqual([])
  expect(status()).toBe('0 of 9')
})

test('the tree keeps and counts what the facet chips keep', async () => {
  const { model, status, filter } = await setup()
  filter('', K562)
  expect(treeTrackIds(model).toSorted()).toEqual(['t0', 't1', 't4', 't5'])
  expect(status()).toBe('4 of 9')
})

test('the tree keeps and counts what the text and the facets both keep', async () => {
  const { model, status, filter } = await setup()
  filter('even', K562)
  expect(treeTrackIds(model).toSorted()).toEqual(['t0', 't4'])
  expect(status()).toBe('2 of 9')

  filter('-even', { 'metadata.assay': ['DNase'] })
  expect(treeTrackIds(model).toSorted()).toEqual(['t5'])
  expect(status()).toBe('1 of 9')
})

test('the favorites list keeps and counts only its own tracks', async () => {
  const { model, status, filter } = await setup()
  act(() => {
    for (const id of ['t4', 't0', 't3']) {
      model.addToFavorites(id)
    }
    model.setTrackList('favorites')
  })
  expect(treeTrackIds(model)).toEqual(['t4', 't0', 't3'])
  expect(status()).toBeUndefined()

  filter('', K562)
  expect(treeTrackIds(model)).toEqual(['t4', 't0'])
  expect(status()).toBe('2 of 3')

  filter('odd')
  expect(treeTrackIds(model)).toEqual([])
  expect(status()).toBe('0 of 3')

  filter('even', { 'metadata.biosample': [] })
  expect(treeTrackIds(model)).toEqual(['t4', 't0'])
  expect(status()).toBe('2 of 3')
})

test('a track in two groups is drawn in both and counted once', async () => {
  const { model, status, filter } = await setup({ connectionTracks: [0, 3] })
  filter('even', K562)
  expect(treeTrackIds(model).toSorted()).toEqual(['t0', 't0', 't4'])
  expect(status()).toBe('2 of 9')
})
