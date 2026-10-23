import { waitFor } from '@testing-library/react'

import { createViewState } from './index.ts'

import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'

jest.mock('./makeWorkerInstance', () => () => {})

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'seq',
          start: 0,
          end: 10,
          seq: 'cattgttgcg',
        },
      ],
    },
  },
}

const TRACK_ID = 'genes'

// ADR-204: "Clear all filters" writes back what the track's config declares,
// and the count compares against it, so an admin's filter is no narrowing.
test('a filter the config declares counts nothing, and the clear returns to it', async () => {
  const state = createViewState({
    assembly,
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: TRACK_ID,
        name: 'Genes',
        assemblyNames: ['volvox'],
        adapter: { type: 'FromConfigAdapter', features: [] },
        displays: [
          {
            type: 'LinearBasicDisplay',
            displayId: `${TRACK_ID}-LinearBasicDisplay`,
            filter: ['geneLike'],
          },
        ],
      },
    ],
  })
  const { view } = state.session
  view.showTrack(TRACK_ID)
  await waitFor(() => {
    expect(view.getTrack(TRACK_ID)).toBeTruthy()
  })
  const display = view.getTrack(TRACK_ID)!.displays[0] as unknown as {
    genesFilter: string | undefined
    setGenesFilter: (value?: string) => void
    featureNarrowings: () => Reversibles
  }
  const genes = () => display.featureNarrowings().genes!
  expect(genes().count).toBe(0)
  display.setGenesFilter(undefined)
  expect(display.genesFilter).toBeUndefined()
  expect(genes().count).toBe(1)
  genes().clear()
  expect(display.genesFilter).toBe('only')
  expect(genes().count).toBe(0)
})
