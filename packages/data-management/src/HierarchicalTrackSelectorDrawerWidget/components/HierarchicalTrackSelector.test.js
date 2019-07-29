import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { createMuiTheme } from '@material-ui/core'
import { ThemeProvider } from '@material-ui/styles'
import React from 'react'
import { cleanup, render, waitForElement } from 'react-testing-library'
import HierarchicalTrackSelector from './HierarchicalTrackSelector'

window.requestIdleCallback = cb => cb()
window.cancelIdleCallback = () => {}

describe('HierarchicalTrackSelector drawer widget', () => {
  afterEach(cleanup)

  it('renders nothing with no dataset', () => {
    const session = createTestSession()
    const firstView = session.addView('LinearGenomeView')
    const model = firstView.activateTrackSelector()

    const { container } = render(
      <ThemeProvider theme={createMuiTheme()}>
        <HierarchicalTrackSelector model={model} />
      </ThemeProvider>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with a couple of uncategorized tracks', async () => {
    const session = createTestSession()
    session.addDataset({
      name: 'volvox',
      assembly: {
        name: 'volMyt1',
        sequence: {
          configId: 'sequenceConfigId',
          adapter: {
            type: 'FromConfigAdapter',
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
      },
      tracks: [
        {
          configId: 'fooC',
          type: 'BasicTrack',
          adapter: { type: 'FromConfigAdapter', features: [] },
        },
        {
          configId: 'barC',
          type: 'BasicTrack',
          adapter: { type: 'FromConfigAdapter', features: [] },
        },
      ],
    })
    const firstView = session.addLinearGenomeViewOfDataset('volvox')
    firstView.showTrack(session.datasets[0].tracks[0])
    firstView.showTrack(session.datasets[0].tracks[1])
    const model = firstView.activateTrackSelector()

    const { container, getByTestId } = render(
      <ThemeProvider theme={createMuiTheme()}>
        <HierarchicalTrackSelector model={model} />
      </ThemeProvider>,
    )
    await waitForElement(() => getByTestId('hierarchical_track_selector'))
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with a couple of categorized tracks', async () => {
    const session = createTestSession()
    session.addDataset({
      name: 'volvox',
      assembly: {
        name: 'volvox',
        sequence: {
          configId: 'sequenceConfigId',
          adapter: {
            name: 'volMyt1',
            type: 'FromConfigAdapter',
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
      },
      tracks: [
        {
          configId: 'fooC',
          type: 'BasicTrack',
          adapter: { type: 'FromConfigAdapter', features: [] },
        },
        {
          configId: 'barC',
          type: 'BasicTrack',
          adapter: { type: 'FromConfigAdapter', features: [] },
        },
      ],
    })
    const firstView = session.addLinearGenomeViewOfDataset('volvox')
    firstView.showTrack(session.datasets[0].tracks[0])
    firstView.showTrack(session.datasets[0].tracks[1])
    firstView.tracks[0].configuration.category.set(['Foo Category'])
    firstView.tracks[1].configuration.category.set([
      'Foo Category',
      'Bar Category',
    ])
    const model = firstView.activateTrackSelector()

    const { container, getByTestId } = render(
      <ThemeProvider theme={createMuiTheme()}>
        <HierarchicalTrackSelector model={model} />
      </ThemeProvider>,
    )
    await waitForElement(() => getByTestId('hierarchical_track_selector'))
    expect(container.firstChild).toMatchSnapshot()
  })
})
