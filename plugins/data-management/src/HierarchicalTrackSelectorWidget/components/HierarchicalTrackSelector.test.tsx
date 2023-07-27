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
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  })
  session.addTrackConf({
    trackId: 'fooC',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  session.addTrackConf({
    trackId: 'barC',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
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
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  })

  session.addTrackConf({
    trackId: 'fooC',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  session.addTrackConf({
    trackId: 'barC',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
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
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  })

  for (const track of conf.tracks) {
    session.addTrackConf(track)
  }

  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
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
  for (let i = 0; i < list.length; i++) {
    expect(list[i].textContent).toMatchSnapshot()
  }
})
