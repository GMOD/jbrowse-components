import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { createTestSessionAsync } from '../rootModel/test_util.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// A reference sequence track's edits are saved as the session's delta over the
// assembly's `sequence`, so the assembly config a page load starts from stays
// as served.
test('a setting toggled on a reference sequence track is saved in the session', async () => {
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
  const { views } = session as unknown as {
    views: {
      tracks: {
        displays: { showForward: boolean; toggleShowForward: () => void }[]
        persistConfigurationNow: () => void
      }[]
    }[]
  }
  const track = views[0]!.tracks[0]!
  const display = track.displays[0]!
  expect(display.showForward).toBe(true)

  display.toggleShowForward()
  track.persistConfigurationNow()

  expect(display.showForward).toBe(false)
  expect(session.trackConfigDeltas.volvox_refseq).toMatchObject({
    displays: [{ forward: { show: false } }],
  })
  expect(
    JSON.stringify(getSnapshot(session.jbrowse.assemblies[0]!.sequence)),
  ).not.toContain('show')
})
