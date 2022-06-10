/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import Controls from './Controls'
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
          hideControls: false,
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

const polygonPoints = {
  left: 0,
  right: 10,
  prevLeft: 0,
  prevRight: 10,
}

describe('View controls component', () => {
  it('renders the component', () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { getByTestId } = render(
      <Controls
        model={model}
        view={model.views[2]}
        polygonPoints={polygonPoints}
      />,
    )
    const com = getByTestId('polygon')
    expect(com).toBeDefined()
  })
  it('renders pan controls when controls not hidden', () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { getByTestId } = render(
      <Controls
        model={model}
        view={model.views[1]}
        polygonPoints={polygonPoints}
      />,
    )
    const com = getByTestId('panleft')
    expect(com).toBeDefined()
  })
  it('pan left', async () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { getByTestId, findByText } = render(
      <Controls
        model={model}
        view={model.views[1]}
        polygonPoints={polygonPoints}
      />,
    )
    const com = getByTestId('panleft')
    fireEvent.click(com)
    expect(await findByText('0 bp')).toBeDefined()
  })
  it('pan right', async () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { getByTestId, findByText } = render(
      <Controls
        model={model}
        view={model.views[1]}
        polygonPoints={polygonPoints}
      />,
    )
    const com = getByTestId('panright')
    fireEvent.click(com)
    expect(await findByText('0 bp')).toBeDefined()
  })
})
