/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import Subheader from './Subheader'
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

const polygonPoints = {
  left: 0,
  right: 10,
  prevLeft: 0,
  prevRight: 10,
}

describe('MLLV Subheader component', () => {
  console.warn = jest.fn()
  it('renders the component with extra buttons', () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { getByTitle } = render(
      <Subheader
        model={model}
        view={model.views[1]}
        polygonPoints={polygonPoints}
      />,
    )
    const com = getByTitle('Open view menu')
    expect(com).toBeDefined()
  })
  it('clicks open view menu', async () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { findByTitle, getByText } = render(
      <Subheader
        model={model}
        view={model.views[1]}
        polygonPoints={polygonPoints}
      />,
    )
    const com = await findByTitle('Open view menu')
    fireEvent.click(com)
    expect(getByText('Export SVG')).toBeDefined()
  })
  it('hides the view', async () => {
    const session = createTestSession(sessionConfig) as any
    session.addAssemblyConf(assemblyConf)
    const model = session.views[0]
    const { findByTitle } = render(
      <Subheader
        model={model}
        view={model.views[1]}
        polygonPoints={polygonPoints}
      />,
    )
    const com = await findByTitle('Toggle show/hide view')
    fireEvent.click(com)
    expect(model.views[1].isVisible).toBe(false)
  })
})
