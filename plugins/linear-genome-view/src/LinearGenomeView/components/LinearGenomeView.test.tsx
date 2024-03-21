import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import 'requestidlecallback-polyfill'

// locals
import LinearGenomeView from './LinearGenomeView'

// mock
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

const assemblyConf = {
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
}

test('renders setup wizard', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.addView('LinearGenomeView', { id: 'lgv' })
  const model = session.views[0]
  model.setWidth(800)
  const { findByText } = render(<LinearGenomeView model={model} />)
  expect(model.displayedRegions.length).toEqual(0)
  const elt = await findByText('Open', {}, { timeout: 10000 })
  await waitFor(() => expect(elt.getAttribute('disabled')).toBe(null))
  fireEvent.click(elt)
  await waitFor(() => expect(model.displayedRegions.length).toEqual(1), {
    timeout: 15000,
  })
}, 15000)

test('renders one track, one region', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.addTrackConf({
    adapter: { features: [], type: 'FromConfigAdapter' },
    assemblyNames: ['volMyt1'],
    name: 'Foo Track',
    trackId: 'testConfig',
    type: 'BasicTrack',
  })
  session.addView('LinearGenomeView', {
    bpPerPx: 1,
    displayedRegions: [
      { assemblyName: 'volMyt1', end: 100, refName: 'ctgA', start: 0 },
    ],
    id: 'lgv',
    offsetPx: 0,
    tracks: [
      {
        configuration: 'testConfig',
        displays: [
          {
            configuration: 'testConfig-LinearBareDisplay',
            type: 'LinearBareDisplay',
          },
        ],
        height: 20,
        id: 'foo',
        type: 'BasicTrack',
      },
    ],
    type: 'LinearGenomeView',
  })
  const model = session.views[0]
  model.setWidth(800)
  const { container, queryAllByTestId, getByPlaceholderText, findByText } =
    render(<LinearGenomeView model={model} />)
  await findByText('Foo Track')
  // test needs to wait until it's updated to display 100 bp in the header to
  // make snapshot pass
  await findByText('100bp')

  await waitFor(() => {
    expect(
      (getByPlaceholderText('Search for location') as HTMLInputElement).value,
    ).toEqual('ctgA:1..100')
  })
  await waitFor(() => expect(queryAllByTestId('svgfeatures').length).toBe(1))
  // snapshot has no features rendered
  expect(container).toMatchSnapshot()
})

test('renders two tracks, two regions', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.addTrackConf({
    adapter: { features: [], type: 'FromConfigAdapter' },
    assemblyNames: ['volMyt1'],
    name: 'Foo Track',
    trackId: 'testConfig',
    type: 'BasicTrack',
  })

  session.addTrackConf({
    adapter: { features: [], type: 'FromConfigAdapter' },
    assemblyNames: ['volMyt1'],
    name: 'Bar Track',
    trackId: 'testConfig2',
    type: 'BasicTrack',
  })
  session.addView('LinearGenomeView', {
    bpPerPx: 1,
    displayedRegions: [
      { assemblyName: 'volMyt1', end: 100, refName: 'ctgA', start: 0 },
      {
        assemblyName: 'volMyt1',
        end: 2000,
        refName: 'ctgB',
        start: 1000,
      },
    ],
    id: 'lgv',
    offsetPx: 0,
    tracks: [
      {
        configuration: 'testConfig',
        displays: [
          {
            configuration: 'testConfig-LinearBareDisplay',
            type: 'LinearBareDisplay',
          },
        ],
        height: 20,
        id: 'foo',
        type: 'BasicTrack',
      },
      {
        configuration: 'testConfig2',
        displays: [
          {
            configuration: 'testConfig2-LinearBareDisplay',
            type: 'LinearBareDisplay',
          },
        ],
        height: 20,
        id: 'bar',
        type: 'BasicTrack',
      },
    ],
  })
  const model = session.views[0]
  model.setWidth(800)
  const { container, findByDisplayValue, findByText, queryAllByTestId } =
    render(<LinearGenomeView model={model} />)
  await findByText('Foo Track')
  await findByText('798bp')
  await findByDisplayValue('ctgA:1..100 ctgB:1,001..1,698')
  await waitFor(() => expect(queryAllByTestId('svgfeatures').length).toBe(4))
  expect(container).toMatchSnapshot()
}, 15000)
