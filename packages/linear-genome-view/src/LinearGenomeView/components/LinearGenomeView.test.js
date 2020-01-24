import React from 'react'
import { render } from '@testing-library/react'
import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import sizeMe from 'react-sizeme'
import 'requestidlecallback-polyfill'
import LinearGenomeView from './LinearGenomeView'

sizeMe.noPlaceholders = true

describe('LinearGenomeView genome view component', () => {
  it('renders with an empty model', () => {
    const session = createTestSession({
      views: [
        {
          type: 'LinearGenomeView',
          id: 'lgv',
          offsetPx: 0,
          bpPerPx: 1,
          tracks: [],
          controlsWidth: 100,
          configuration: {},
        },
      ],
    })
    const model = session.views[0]
    const { container } = render(<LinearGenomeView model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })
  it('renders one track, no blocks', () => {
    const session = createTestSession({
      views: [
        {
          type: 'LinearGenomeView',
          id: 'lgv',
          offsetPx: 0,
          bpPerPx: 1,
          tracks: [
            {
              id: 'foo',
              type: 'BasicTrack',
              height: 20,
              configuration: 'testConfig',
            },
          ],
          controlsWidth: 100,
          configuration: {},
        },
      ],
    })
    session.addAssemblyConf({
      name: 'volMyt1',
      sequence: {
        trackId: 'ref0',
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
      trackId: 'testConfig',
      name: 'Foo Track',
      type: 'BasicTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
    const model = session.views[0]
    const { container } = render(<LinearGenomeView model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })
  it('renders two tracks, two regions', () => {
    const session = createTestSession()
    session.addAssemblyConf({
      name: 'volMyt1',
      sequence: {
        trackId: 'ref0',
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
      trackId: 'testConfig',
      name: 'Foo Track',
      assemblyNames: ['volMyt1'],
      type: 'BasicTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
    session.addTrackConf({
      trackId: 'testConfig2',
      name: 'Bar Track',
      assemblyNames: ['volMyt1'],
      type: 'BasicTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
    session.addView('LinearGenomeView', {
      id: 'lgv',
      offsetPx: 0,
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 100 },
        {
          assemblyName: 'volMyt1',
          refName: 'ctgB',
          start: 1000,
          end: 200,
        },
      ],
      tracks: [
        {
          id: 'foo',
          type: 'BasicTrack',
          height: 20,
          configuration: 'testConfig',
        },
        {
          id: 'bar',
          type: 'BasicTrack',
          height: 20,
          configuration: 'testConfig2',
        },
      ],
      controlsWidth: 100,
      configuration: {},
    })
    const model = session.views[0]
    const { container } = render(<LinearGenomeView model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
