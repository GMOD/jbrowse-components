import React from 'react'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, waitFor } from '@testing-library/react'

// locals
import LinearGenomeView from './LinearGenomeView'
import type { LinearGenomeViewModel } from '../model'

// mock
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

function LGV({ model }: { model: LinearGenomeViewModel }) {
  return (
    <ThemeProvider theme={createJBrowseTheme()}>
      <LinearGenomeView model={model} />
    </ThemeProvider>
  )
}

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

test('renders setup wizard', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.addView('LinearGenomeView', { id: 'lgv' })
  const model = session.views[0]
  model.setWidth(800)
  const { findByText } = render(<LGV model={model} />)
  expect(model.displayedRegions.length).toEqual(0)
  const elt = await findByText('Open', {}, { timeout: 10000 })
  await waitFor(() => {
    expect(elt.getAttribute('disabled')).toBe(null)
  })
  fireEvent.click(elt)
  await waitFor(
    () => {
      expect(model.displayedRegions.length).toEqual(1)
    },
    {
      timeout: 15000,
    },
  )
}, 15000)

test('renders one track, one region', async () => {
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
  const { container, queryAllByTestId, getByPlaceholderText, findByText } =
    render(<LGV model={model} />)
  await findByText('Foo Track')
  // test needs to wait until it's updated to display 100 bp in the header to
  // make snapshot pass
  await findByText('100bp')

  await waitFor(() => {
    expect(
      (getByPlaceholderText('Search for location') as HTMLInputElement).value,
    ).toEqual('ctgA:1..100')
  })
  await waitFor(() => {
    expect(queryAllByTestId('svgfeatures').length).toBe(1)
  })
  // snapshot has no features rendered
  expect(container).toMatchSnapshot()
})

test('renders two tracks, two regions', async () => {
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
  const { container, findByDisplayValue, findByText, queryAllByTestId } =
    render(<LGV model={model} />)
  await findByText('Foo Track')
  await findByText('798bp')
  await findByDisplayValue('ctgA:1..100 ctgB:1,001..1,698')
  await waitFor(() => {
    expect(queryAllByTestId('svgfeatures').length).toBe(4)
  })
  expect(container).toMatchSnapshot()
}, 15000)
