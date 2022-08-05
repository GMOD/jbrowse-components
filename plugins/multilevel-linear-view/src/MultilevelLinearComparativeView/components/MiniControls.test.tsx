/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import MiniControls from './MiniControls'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

const sessionConfig = {
  views: [
    {
      type: 'MultilevelLinearView',
      offsetPx: 0,
      bpPerPx: 1,
      displayedRegions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
        {
          assemblyName: 'volvox',
          refName: 'ctgB',
          start: 100,
          end: 200,
        },
      ],
      views: [
        {
          id: 'MoMeeVade',
          type: 'LinearGenomeMultilevelView',
          displayName: 'Overview',
          bpPerPx: 100000,
          isOverview: true,
          limitBpPerPx: {
            limited: true,
            upperLimit: 100001,
            lowerLimit: 100000,
          },
          displayedRegions: [
            {
              refName: '3',
              start: 0,
              end: 186700647,
              assemblyName: 'hg38',
            },
          ],
          tracks: [],
        },
        {
          id: 'MoMeeVasdfade',
          type: 'LinearGenomeMultilevelView',
          displayName: 'Region',
          bpPerPx: 100,
          limitBpPerPx: {
            limited: true,
            upperlimit: 10000,
            lowerLimit: 1,
          },
          displayedRegions: [
            {
              refName: '3',
              start: 0,
              end: 186700647,
              assemblyName: 'hg38',
            },
          ],
          tracks: [],
        },
        {
          id: 'MoasdfMeeVade',
          type: 'LinearGenomeMultilevelView',
          displayName: 'Details',
          bpPerPx: 1,
          isAnchor: true,
          limitBpPerPx: {
            limited: false,
            upperlimit: 1,
            lowerLimit: 1,
          },
          displayedRegions: [
            {
              refName: '3',
              start: 85313457,
              end: 86313456,
              assemblyName: 'hg38',
            },
          ],
          tracks: [],
        },
      ],
      tracks: [],
      configuration: {},
    },
  ],
}

const assemblyConf = {
  name: 'volMyt1',
  sequence: {
    trackId: 'ref0',
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

describe('MLLV Mini controls component', () => {
  console.warn = jest.fn()
  it('renders the component', () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { getByTestId } = render(<MiniControls model={model.views[1]} />)
    const com = getByTestId('mllv-minicontrols')
    expect(com).toBeDefined()
  })
  it('zooms in on view 1', async () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { findByTestId, findByText } = render(
      <MiniControls model={model.views[1]} />,
    )
    const com = await findByTestId('zoom_in')
    await waitFor(() => {
      fireEvent.click(com)
      expect(findByText('94800 bp')).toBeDefined()
    })
  })
  it('zooms out on view 1', async () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { findByTestId, findByText } = render(
      <MiniControls model={model.views[1]} />,
    )
    const com = await findByTestId('zoom_out')
    await waitFor(() => {
      fireEvent.click(com)
      expect(findByText('284,400 bp')).toBeDefined()
    })
  })
  it('cannot zoom in on view 0', async () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { findByTestId } = render(<MiniControls model={model.views[0]} />)
    const com = await findByTestId('zoom_out')
    await waitFor(() => {
      expect(com).toHaveProperty('disabled', true)
    })
  })
  it('clicks open view menu', async () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { findByTestId, getByText } = render(
      <MiniControls model={model.views[0]} />,
    )
    const com = await findByTestId('mllv-minicontrols-menu')
    fireEvent.click(com)
    expect(getByText('Export SVG')).toBeDefined()
  })
  it('hides the view', async () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { findByTestId, findByText } = render(
      <MiniControls model={model.views[1]} />,
    )
    const com = await findByTestId('mllv-minicontrols-menu')
    fireEvent.click(com)
    const hide = await findByText('Hide view')
    fireEvent.click(hide)
    expect(model.views[1].isVisible).toBe(false)
  })
})
