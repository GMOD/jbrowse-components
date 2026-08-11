import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render, waitFor } from '@testing-library/react'
import { when } from 'mobx'

import HierarchicalTrackSelector from './HierarchicalTrackSelector.tsx'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function assemblyConf(name: string) {
  return {
    name,
    sequence: {
      trackId: `${name}-seq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
        ],
      },
    },
  }
}

async function setup() {
  const session = createTestSession({ adminMode: true })
  for (const name of ['hg38', 'mm10', 'rn7']) {
    session.addAssemblyConf(assemblyConf(name))
  }
  session.addTrackConf({
    trackId: 'pairwise',
    name: 'pairwise',
    type: 'SyntenyTrack',
    assemblyNames: ['mm10', 'hg38'],
    adapter: {
      type: 'PAFAdapter',
      assemblyNames: ['mm10', 'hg38'],
      pafLocation: { uri: 'test.paf' },
    },
  })
  session.addTrackConf({
    trackId: 'everything',
    name: 'everything',
    type: 'SyntenyTrack',
    assemblyNames: ['hg38', 'mm10', 'rn7'],
    adapter: {
      type: 'AllVsAllPAFAdapter',
      assemblyNames: ['hg38', 'mm10', 'rn7'],
      pafLocation: { uri: 'all.paf' },
    },
  })
  session.addTrackConf({
    trackId: 'genes',
    name: 'genes',
    type: 'FeatureTrack',
    assemblyNames: ['hg38'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const { assemblyManager } = session
  await when(
    () =>
      assemblyManager.assemblies.length ===
      assemblyManager.assemblyNamesList.length,
  )
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'hg38', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  return {
    session,
    model: view.activateTrackSelector() as HierarchicalTrackSelectorModel,
  }
}

function renderTree(model: HierarchicalTrackSelectorModel) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )
}

test('a synteny row says what it compares against', async () => {
  const { model } = await setup()
  const { findByTestId } = renderTree(model)
  expect(
    (await findByTestId('htsTrackAdornment-Tracks,pairwise')).textContent,
  ).toBe('vs mm10')
  expect(
    (await findByTestId('htsTrackAdornment-Tracks,everything')).textContent,
  ).toBe('vs all samples')
})

test('an ordinary track gets no adornment', async () => {
  const { model } = await setup()
  const { findByTestId, queryByTestId } = renderTree(model)
  // wait for the tree to render before asserting on an absence
  await findByTestId('htsTrackLabel-Tracks,genes')
  expect(queryByTestId('htsTrackAdornment-Tracks,genes')).toBeNull()
})

// the tree's rule is that the filter box searches what the tree shows, and the
// suffix is on screen
test('the filter box finds a track by the assembly it is compared against', async () => {
  const { model } = await setup()
  model.setFilterText('mm10')
  expect(
    [...model.filteredTrackSet].map(c => `${c.trackId}`).toSorted(),
  ).toEqual(['pairwise'])
})

// The all-vs-all track aligns mm10 and is not found by searching for it, which
// follows from the same rule rather than contradicting it: its row says "vs all
// samples" because naming its configured assemblies would misrepresent what it
// draws, and a search term that never appears on screen is the drift
// buildSearchText exists to prevent. Searching what it does say finds it.
test('an all-vs-all track is found by what its row actually claims', async () => {
  const { model } = await setup()
  model.setFilterText('all samples')
  expect([...model.filteredTrackSet].map(c => `${c.trackId}`)).toEqual([
    'everything',
  ])
})

// often the mate is already in the track's own name, where the suffix is pure
// repetition — so it is switchable, per config and per user
test('the annotations toggle takes the suffix off the row and out of search', async () => {
  const { model } = await setup()
  const { findByTestId, queryByTestId } = renderTree(model)
  await findByTestId('htsTrackAdornment-Tracks,pairwise')

  model.setTrackAdornments(false)
  await waitFor(() => {
    expect(queryByTestId('htsTrackAdornment-Tracks,pairwise')).toBeNull()
  })
  model.setFilterText('all samples')
  expect([...model.filteredTrackSet]).toEqual([])

  model.clearFilterText()
  model.setTrackAdornments(true)
  expect(
    (await findByTestId('htsTrackAdornment-Tracks,pairwise')).textContent,
  ).toBe('vs mm10')
})

test('a config can start with the annotations off', async () => {
  const session = createTestSession({
    adminMode: true,
    jbrowseConfig: {
      configuration: { hierarchical: { trackAdornments: false } },
    },
  })
  session.addAssemblyConf(assemblyConf('hg38'))
  session.addAssemblyConf(assemblyConf('mm10'))
  session.addTrackConf({
    trackId: 'pairwise',
    name: 'pairwise',
    type: 'SyntenyTrack',
    assemblyNames: ['mm10', 'hg38'],
    adapter: {
      type: 'PAFAdapter',
      assemblyNames: ['mm10', 'hg38'],
      pafLocation: { uri: 'test.paf' },
    },
  })
  const { assemblyManager } = session
  await when(
    () =>
      assemblyManager.assemblies.length ===
      assemblyManager.assemblyNamesList.length,
  )
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'hg38', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  expect(model.activeTrackAdornments).toBe(false)
  expect(model.allTracks[0]!.tracks.every(t => !t.adornment)).toBe(true)
})
