import React from 'react'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import { render } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'

// locals
import HierarchicalTrackSelector from './HierarchicalTrackSelector'

import conf from '../../../../../test_data/test_order/config.json'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

test('renders nothing with no assembly', () => {
  const session = createTestSession()
  const firstView = session.addView('LinearGenomeView')
  const model = firstView.activateTrackSelector()

  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )
  expect(container).toMatchSnapshot()
})

test('renders with a couple of uncategorized tracks', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      adapter: {
        features: [
          {
            end: 10,
            refName: 'ctgA',
            seq: 'cattgttgcg',
            start: 0,
            uniqueId: 'firstId',
          },
        ],
        type: 'FromConfigSequenceAdapter',
      },
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
    },
  })
  session.addTrackConf({
    adapter: { features: [], type: 'FromConfigAdapter' },
    assemblyNames: ['volMyt1'],
    trackId: 'fooC',
    type: 'FeatureTrack',
  })
  session.addTrackConf({
    adapter: { features: [], type: 'FromConfigAdapter' },
    assemblyNames: ['volMyt1'],
    trackId: 'barC',
    type: 'FeatureTrack',
  })
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        end: 1000,
        refName: 'ctgA',
        start: 0,
      },
    ],
  })
  firstView.showTrack(session.sessionTracks[0].trackId)
  firstView.showTrack(session.sessionTracks[1].trackId)
  const model = firstView.activateTrackSelector()

  const { container, findByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )
  await findByTestId('hierarchical_track_selector')
  expect(container).toMatchSnapshot()
})

test('renders with a couple of categorized tracks', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      adapter: {
        features: [
          {
            end: 10,
            refName: 'ctgA',
            seq: 'cattgttgcg',
            start: 0,
            uniqueId: 'firstId',
          },
        ],
        type: 'FromConfigSequenceAdapter',
      },
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
    },
  })

  session.addTrackConf({
    adapter: { features: [], type: 'FromConfigAdapter' },
    assemblyNames: ['volMyt1'],
    trackId: 'fooC',
    type: 'FeatureTrack',
  })
  session.addTrackConf({
    adapter: { features: [], type: 'FromConfigAdapter' },
    assemblyNames: ['volMyt1'],
    trackId: 'barC',
    type: 'FeatureTrack',
  })
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        end: 1000,
        refName: 'ctgA',
        start: 0,
      },
    ],
  })
  firstView.showTrack(session.sessionTracks[0].trackId)
  firstView.showTrack(session.sessionTracks[1].trackId)
  firstView.tracks[0].configuration.category.set(['Foo Category'])
  firstView.tracks[1].configuration.category.set([
    'Foo Category',
    'Bar Category',
  ])
  const model = firstView.activateTrackSelector()

  const { container, findByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )
  await findByTestId('hierarchical_track_selector')
  expect(container).toMatchSnapshot()
})

test('right order when using multiple categories', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      adapter: {
        features: [
          {
            end: 10,
            refName: 'ctgA',
            seq: 'cattgttgcg',
            start: 0,
            uniqueId: 'firstId',
          },
        ],
        type: 'FromConfigSequenceAdapter',
      },
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
    },
  })

  for (const track of conf.tracks) {
    session.addTrackConf(track)
  }

  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        end: 1000,
        refName: 'ctgA',
        start: 0,
      },
    ],
  })

  const model = firstView.activateTrackSelector()

  const { getAllByTestId, findByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )
  await findByTestId('hierarchical_track_selector')

  const list = getAllByTestId('htsTrackLabel', {
    exact: false,
  })
  for (const entry of list) {
    expect(entry.textContent).toMatchSnapshot()
  }
})
