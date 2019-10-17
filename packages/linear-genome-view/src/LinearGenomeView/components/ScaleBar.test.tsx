/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
// eslint-disable-next-line import/no-extraneous-dependencies
import { render } from '@testing-library/react'
// eslint-disable-next-line import/no-extraneous-dependencies
import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import ScaleBar from './ScaleBar'

describe('ScaleBar genome view component', () => {
  it('renders two regions', () => {
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
              start: 100,
              end: 200,
            },
          ],
          tracks: [],
          controlsWidth: 100,
          configuration: {},
        },
      ],
    }) as any
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
    })
    const model = session.views[0]
    const { getByTestId } = render(<ScaleBar height={32} model={model} />)
    const ret1 = getByTestId('refLabel-ctgA')
    const ret2 = getByTestId('refLabel-ctgB')
    expect(ret1.style.left).toBe('0px')
    expect(ret2.style.left).toBe('102px')
  })
  it('renders two regions when scrolled to the left, the label is ctgA to the actual blocks', () => {
    const session = createTestSession({
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: -100,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
            { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 100 },
          ],
          tracks: [],
          controlsWidth: 100,
          configuration: {},
        },
      ],
    }) as any
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
    })
    const model = session.views[0]
    const { getByTestId } = render(<ScaleBar height={32} model={model} />)
    const ret1 = getByTestId('refLabel-ctgA')
    const ret2 = getByTestId('refLabel-ctgB')
    expect(ret1.style.left).toBe('100px')
    expect(ret2.style.left).toBe('202px')
  })
})
