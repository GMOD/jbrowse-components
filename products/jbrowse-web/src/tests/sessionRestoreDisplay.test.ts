import { createTestSession } from '../rootModel/index.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// Regression: on session restore the view has no measured width yet
// (volatileWidth undefined). A canvas display's afterAttach must not read any
// getter that transitively reads view.width — that throws, propagates out of
// display instantiation, and made the session loader drop the display as
// "unhydratable", leaving a track with empty displays that later crashed
// trackHeights on displays[0].height.
test('canvas display survives session restore before view width is measured', () => {
  const session = createTestSession({
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
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'testtrack',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'FromConfigAdapter',
            features: [],
          },
          displays: [{ type: 'LinearBasicDisplay' }],
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
              type: 'FeatureTrack',
              configuration: 'testtrack',
              displays: [{ id: 'display1', type: 'LinearBasicDisplay' }],
            },
          ],
        },
      ],
    },
  })

  expect(session.views[0].tracks[0].displays.length).toBe(1)
})
