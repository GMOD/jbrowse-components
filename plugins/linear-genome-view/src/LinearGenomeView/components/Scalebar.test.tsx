import { createTestSession } from '@jbrowse/web/src/rootModel'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import Scalebar from './Scalebar'

afterEach(() => {
  cleanup()
})

test('renders two regions', async () => {
  const session = createTestSession({
    sessionSnapshot: {
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
          configuration: {},
        },
      ],
    },
  }) as any
  session.addAssemblyConf({
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
  })
  const model = session.views[0]
  const { getByTestId } = render(<Scalebar model={model} />)
  await waitFor(() => {
    expect(getByTestId('refLabel-ctgA')).toBeTruthy()
    expect(getByTestId('refLabel-ctgB')).toBeTruthy()
  })
})

test('renders two regions when scrolled to the left, the label is ctgA to the actual blocks', () => {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: -100,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
            { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 1 },
            { assemblyName: 'volvox', refName: 'ctgC', start: 0, end: 1 },
            { assemblyName: 'volvox', refName: 'ctgD', start: 0, end: 1 },
          ],
          tracks: [],
          configuration: {},
        },
      ],
    },
  }) as any
  session.addAssemblyConf({
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
