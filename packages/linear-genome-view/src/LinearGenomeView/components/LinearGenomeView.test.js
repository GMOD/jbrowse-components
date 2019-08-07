import React from 'react'
import { render } from '@testing-library/react'
import { createTestSession } from '@gmod/jbrowse-web/src/jbrowseModel'
import LinearGenomeView from './LinearGenomeView'

describe('LinearGenomeView genome view component', () => {
  it('renders with an empty model', () => {
    const session = createTestSession({
      views: [
        {
          type: 'LinearGenomeView',
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
    session.addDataset({
      name: 'volvox',
      assembly: {
        name: 'volMyt1',
        sequence: {
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
          configId: 'testConfig',
          name: 'Foo Track',
          type: 'BasicTrack',
          adapter: { type: 'FromConfigAdapter', features: [] },
        },
      ],
    })
    const model = session.views[0]
    const { container } = render(<LinearGenomeView model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })
  it('renders two tracks, two regions', () => {
    const session = createTestSession({
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
            {
              assemblyName: 'volvox',
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
        },
      ],
    })
    session.addDataset({
      name: 'volvox',
      assembly: {
        assemblyName: 'volMyt1',
        sequence: {
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
          configId: 'testConfig',
          name: 'Foo Track',
          type: 'BasicTrack',
          adapter: { type: 'FromConfigAdapter', features: [] },
        },
        {
          configId: 'testConfig2',
          name: 'Bar Track',
          type: 'BasicTrack',
          adapter: { type: 'FromConfigAdapter', features: [] },
        },
      ],
    })
    const model = session.views[0]
    const { container } = render(<LinearGenomeView model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
