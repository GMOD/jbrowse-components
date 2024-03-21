/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render } from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import Scalebar from './Scalebar'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

describe('Scalebar genome view component', () => {
  it('renders two regions', () => {
    const session = createTestSession({
      views: [
        {
          bpPerPx: 1,
          configuration: {},
          displayedRegions: [
            { assemblyName: 'volvox', end: 100, refName: 'ctgA', start: 0 },
            {
              assemblyName: 'volvox',
              end: 200,
              refName: 'ctgB',
              start: 100,
            },
          ],
          offsetPx: 0,
          tracks: [],
          type: 'LinearGenomeView',
        },
      ],
    }) as any
    session.addAssemblyConf({
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
        trackId: 'ref0',
        type: 'ReferenceSequenceTrack',
      },
    })
    const model = session.views[0]
    const { getByTestId } = render(<Scalebar model={model} />)
    const ret1 = getByTestId('refLabel-ctgA')
    const ret2 = getByTestId('refLabel-ctgB')
    expect(ret1.style.left).toBe('-1px')
    expect(ret2.style.left).toBe('101px')
  })
  it('renders two regions when scrolled to the left, the label is ctgA to the actual blocks', () => {
    const session = createTestSession({
      views: [
        {
          bpPerPx: 1,
          configuration: {},
          displayedRegions: [
            { assemblyName: 'volvox', end: 100, refName: 'ctgA', start: 0 },
            { assemblyName: 'volvox', end: 100, refName: 'ctgB', start: 0 },
          ],
          offsetPx: -100,
          tracks: [],
          type: 'LinearGenomeView',
        },
      ],
    }) as any
    session.addAssemblyConf({
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
        trackId: 'ref0',
        type: 'ReferenceSequenceTrack',
      },
    })
    const model = session.views[0]
    const { getByTestId } = render(<Scalebar model={model} />)
    const ret1 = getByTestId('refLabel-ctgA')
    const ret2 = getByTestId('refLabel-ctgB')
    expect(ret1.style.left).toBe('99px')
    expect(ret2.style.left).toBe('201px')
  })

  it('renders two regions when scrolled to the left, the label is ctgA to the actual blocks', () => {
    const session = createTestSession({
      views: [
        {
          bpPerPx: 1,
          configuration: {},
          displayedRegions: [
            { assemblyName: 'volvox', end: 1000, refName: 'ctgA', start: 0 },
            { assemblyName: 'volvox', end: 1, refName: 'ctgB', start: 0 },
            { assemblyName: 'volvox', end: 1, refName: 'ctgC', start: 0 },
            { assemblyName: 'volvox', end: 1, refName: 'ctgD', start: 0 },
          ],
          offsetPx: -100,
          tracks: [],
          type: 'LinearGenomeView',
        },
      ],
    }) as any
    session.addAssemblyConf({
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
        trackId: 'ref0',
        type: 'ReferenceSequenceTrack',
      },
    })
    const model = session.views[0]
    const { queryByTestId } = render(<Scalebar model={model} />)
    const ret2 = queryByTestId('refLabel-ctgB')
    const ret3 = queryByTestId('refLabel-ctgC')
    const ret4 = queryByTestId('refLabel-ctgD')
    expect(ret2).toBe(null)
    expect(ret3).toBe(null)
    expect(ret4).toBe(null)
  })
})
