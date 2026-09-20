import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { createTestSessionAsync } from '../rootModel/test_util.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// A reference sequence track is the `sequence` of an assembly rather than an
// entry in the track list, so a setting written on it has nowhere to go but the
// assembly's own config.
test('a setting toggled on a reference sequence track is saved in its assembly', async () => {
  const session = await createTestSessionAsync({
    jbrowseConfig: {
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'FromConfigSequenceAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'firstId',
                  start: 0,
                  end: 100,
                  seq: 'A'.repeat(100),
                },
              ],
            },
          },
        },
      ],
    },
    sessionSnapshot: {
      views: [
        {
          id: 'view1',
          type: 'LinearGenomeView',
          tracks: [
            {
              id: 'track1',
              type: 'ReferenceSequenceTrack',
              configuration: 'volvox_refseq',
              displays: [
                {
                  id: 'd1',
                  type: 'LinearReferenceSequenceDisplay',
                  configuration: 'volvox_refseq-LinearReferenceSequenceDisplay',
                },
              ],
            },
          ],
        },
      ],
    },
  })
  const { views, jbrowse } = session as unknown as {
    views: {
      tracks: {
        displays: { showForward: boolean; toggleShowForward: () => void }[]
      }[]
    }[]
    jbrowse: object
  }
  const display = views[0]!.tracks[0]!.displays[0]!
  expect(display.showForward).toBe(true)

  display.toggleShowForward()

  expect(display.showForward).toBe(false)
  const saved = getSnapshot(jbrowse) as {
    assemblies: { sequence: { displays: { showForward?: boolean }[] } }[]
  }
  expect(saved.assemblies[0]!.sequence.displays[0]!.showForward).toBe(false)
})
