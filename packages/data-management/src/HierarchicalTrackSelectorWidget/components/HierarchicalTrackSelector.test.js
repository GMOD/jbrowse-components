import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles'
import { cleanup, render, waitForElement } from '@testing-library/react'
import React from 'react'
import HierarchicalTrackSelector from './HierarchicalTrackSelector'

window.requestIdleCallback = cb => cb()
window.cancelIdleCallback = () => {}

describe('HierarchicalTrackSelector widget', () => {
  afterEach(cleanup)

  it('renders nothing with no assembly', () => {
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
    session.addAssemblyConf({
      name: 'volMyt1',
      sequence: {
        trackId: 'sequenceConfigId',
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
    })
    session.addTrackConf({
      trackId: 'fooC',
      assemblyNames: ['volMyt1'],
      type: 'BasicTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
    session.addTrackConf({
      trackId: 'barC',
      assemblyNames: ['volMyt1'],
      type: 'BasicTrack',
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
    firstView.showTrack(session.tracks[0])
    firstView.showTrack(session.tracks[1])
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
    session.addAssemblyConf({
      name: 'volMyt1',
      sequence: {
        trackId: 'sequenceConfigId',
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
    })
    session.addTrackConf({
      trackId: 'fooC',
      assemblyNames: ['volMyt1'],
      type: 'BasicTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
    session.addTrackConf({
      trackId: 'barC',
      assemblyNames: ['volMyt1'],
      type: 'BasicTrack',
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
    firstView.showTrack(session.tracks[0])
    firstView.showTrack(session.tracks[1])
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
