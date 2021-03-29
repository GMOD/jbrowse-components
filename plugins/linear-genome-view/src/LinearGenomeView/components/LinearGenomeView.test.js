import React from 'react'
import { render } from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import sizeMe from 'react-sizeme'
import 'requestidlecallback-polyfill'
import LinearGenomeView from './LinearGenomeView'

sizeMe.noPlaceholders = true

const assemblyConf = {
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
}

describe('<LinearGenomeView />', () => {
  it('renders setup wizard', async () => {
    const session = createTestSession()
    session.addAssemblyConf(assemblyConf)
    session.addView('LinearGenomeView', { id: 'lgv' })
    const model = session.views[0]
    model.setWidth(800)
    const { container, findByText } = render(<LinearGenomeView model={model} />)
    const openButton = await findByText('Open')
    expect(container.firstChild).toMatchSnapshot()
    expect(model.displayedRegions.length).toEqual(0)
    openButton.click()
    expect(model.displayedRegions.length).toEqual(1)
  })
  it('renders one track, one region', async () => {
    const session = createTestSession()
    session.addAssemblyConf(assemblyConf)
    session.addTrackConf({
      trackId: 'testConfig',
      assemblyNames: ['volMyt1'],
      name: 'Foo Track',
      type: 'BasicTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
    session.addView('LinearGenomeView', {
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
          displays: [
            {
              type: 'LinearBareDisplay',
              configuration: 'testConfig-LinearBareDisplay',
            },
          ],
        },
      ],
      displayedRegions: [
        { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 100 },
      ],
    })
    const model = session.views[0]
    model.setWidth(800)
    const { container, findByText } = render(<LinearGenomeView model={model} />)
    await findByText('Foo Track')
    // test needs to wait until it's updated to display 100 bp in the header to
    // make snapshot pass
    await findByText('100 bp')
    expect(container.firstChild).toMatchSnapshot()
  })
  it('renders two tracks, two regions', async () => {
    const session = createTestSession()
    session.addAssemblyConf(assemblyConf)
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
          end: 2000,
        },
      ],
      tracks: [
        {
          id: 'foo',
          type: 'BasicTrack',
          height: 20,
          configuration: 'testConfig',
          displays: [
            {
              type: 'LinearBareDisplay',
              configuration: 'testConfig-LinearBareDisplay',
            },
          ],
        },
        {
          id: 'bar',
          type: 'BasicTrack',
          height: 20,
          configuration: 'testConfig2',
          displays: [
            {
              type: 'LinearBareDisplay',
              configuration: 'testConfig2-LinearBareDisplay',
            },
          ],
        },
      ],
    })
    const model = session.views[0]
    model.setWidth(800)
    const { container, findByText } = render(<LinearGenomeView model={model} />)
    await findByText('Foo Track')
    await findByText('798 bp')
    expect(container.firstChild).toMatchSnapshot()
  })
})
