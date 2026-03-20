import {
  migrateConfigSnapshot,
  migrateSessionSnapshot,
} from './migrateSessionSnapshot.ts'

describe('migrateSessionSnapshot', () => {
  test('returns snapshot unchanged when no old display types present', () => {
    const snap = {
      name: 'test session',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'track1',
              displays: [{ type: 'LinearAlignmentsDisplay', id: 'd1' }],
            },
          ],
        },
      ],
    }
    expect(migrateSessionSnapshot(snap)).toBe(snap)
  })

  test('migrates LinearPileupDisplay → LinearAlignmentsDisplay', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'track1',
              displays: [
                {
                  type: 'LinearPileupDisplay',
                  id: 'd1',
                  mismatchAlpha: true,
                },
              ],
            },
          ],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    const display = (result.views as any)[0].tracks[0].displays[0]
    expect(display.type).toBe('LinearAlignmentsDisplay')
    expect(display.id).toBe('d1')
    expect(display.mismatchAlpha).toBe(true)
  })

  test('migrates LinearSNPCoverageDisplay → LinearAlignmentsDisplay', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'track1',
              displays: [{ type: 'LinearSNPCoverageDisplay', id: 'd1' }],
            },
          ],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    const display = (result.views as any)[0].tracks[0].displays[0]
    expect(display.type).toBe('LinearAlignmentsDisplay')
  })

  test('migrates LinearReadArcsDisplay → LinearAlignmentsDisplay', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'track1',
              displays: [{ type: 'LinearReadArcsDisplay', id: 'd1' }],
            },
          ],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    const display = (result.views as any)[0].tracks[0].displays[0]
    expect(display.type).toBe('LinearAlignmentsDisplay')
  })

  test('migrates LinearReadCloudDisplay → LinearAlignmentsDisplay', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'track1',
              displays: [{ type: 'LinearReadCloudDisplay', id: 'd1' }],
            },
          ],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    const display = (result.views as any)[0].tracks[0].displays[0]
    expect(display.type).toBe('LinearAlignmentsDisplay')
  })

  test('handles multiple tracks with mixed display types', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'track1',
              displays: [{ type: 'LinearPileupDisplay', id: 'd1' }],
            },
            {
              trackId: 'track2',
              displays: [{ type: 'LinearWiggleDisplay', id: 'd2' }],
            },
            {
              trackId: 'track3',
              displays: [{ type: 'LinearReadCloudDisplay', id: 'd3' }],
            },
          ],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    const tracks = (result.views as any)[0].tracks
    expect(tracks[0].displays[0].type).toBe('LinearAlignmentsDisplay')
    expect(tracks[1].displays[0].type).toBe('LinearWiggleDisplay')
    expect(tracks[2].displays[0].type).toBe('LinearAlignmentsDisplay')
  })

  test('handles nested views (synteny/breakpoint)', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            {
              type: 'LinearGenomeView',
              tracks: [
                {
                  trackId: 'track1',
                  displays: [{ type: 'LinearPileupDisplay', id: 'd1' }],
                },
              ],
            },
            {
              type: 'LinearGenomeView',
              tracks: [],
            },
          ],
          tracks: [],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    const innerTrack = (result.views as any)[0].views[0].tracks[0]
    expect(innerTrack.displays[0].type).toBe('LinearAlignmentsDisplay')
  })

  test('migrates sessionTracks display types', () => {
    const snap = {
      name: 'test',
      views: [],
      sessionTracks: [
        {
          trackId: 'session-track-1',
          displays: [{ type: 'LinearPileupDisplay', displayId: 'st-d1' }],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    const display = (result.sessionTracks as any)[0].displays[0]
    expect(display.type).toBe('LinearAlignmentsDisplay')
  })

  test('handles snapshot with no views', () => {
    const snap = { name: 'empty' }
    expect(migrateSessionSnapshot(snap)).toBe(snap)
  })

  test('handles empty views array', () => {
    const snap = { name: 'test', views: [] }
    expect(migrateSessionSnapshot(snap)).toBe(snap)
  })

  test('handles tracks without displays array', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [{ trackId: 'track1' }],
        },
      ],
    }
    expect(migrateSessionSnapshot(snap)).toBe(snap)
  })
})

describe('migrateConfigSnapshot', () => {
  test('returns config unchanged when no old display types present', () => {
    const config = {
      assemblies: [],
      tracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'track1',
          displays: [
            { type: 'LinearAlignmentsDisplay', displayId: 'track1-display' },
          ],
        },
      ],
    }
    expect(migrateConfigSnapshot(config)).toBe(config)
  })

  test('returns config unchanged when no tracks', () => {
    const config = { assemblies: [] }
    expect(migrateConfigSnapshot(config)).toBe(config)
  })

  test('migrates LinearPileupDisplay in track config displays', () => {
    const config = {
      tracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'track1',
          displays: [
            {
              type: 'LinearPileupDisplay',
              displayId: 'track1-pileup',
              height: 400,
            },
          ],
        },
      ],
    }
    const result = migrateConfigSnapshot(config)
    const display = (result.tracks as any)[0].displays[0]
    expect(display.type).toBe('LinearAlignmentsDisplay')
    expect(display.displayId).toBe('track1-pileup')
    expect(display.height).toBe(400)
  })

  test('migrates LinearSNPCoverageDisplay in track config displays', () => {
    const config = {
      tracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'track1',
          displays: [
            { type: 'LinearSNPCoverageDisplay', displayId: 'track1-snpcov' },
          ],
        },
      ],
    }
    const result = migrateConfigSnapshot(config)
    expect((result.tracks as any)[0].displays[0].type).toBe(
      'LinearAlignmentsDisplay',
    )
  })

  test('handles multiple tracks with mixed display types', () => {
    const config = {
      tracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'track1',
          displays: [
            { type: 'LinearPileupDisplay', displayId: 'd1' },
            { type: 'LinearSNPCoverageDisplay', displayId: 'd2' },
          ],
        },
        {
          type: 'FeatureTrack',
          trackId: 'track2',
          displays: [{ type: 'LinearBasicDisplay', displayId: 'd3' }],
        },
      ],
    }
    const result = migrateConfigSnapshot(config)
    const tracks = result.tracks as any[]
    expect(tracks[0].displays[0].type).toBe('LinearAlignmentsDisplay')
    expect(tracks[0].displays[1].type).toBe('LinearAlignmentsDisplay')
    expect(tracks[1].displays[0].type).toBe('LinearBasicDisplay')
  })

  test('handles tracks without displays array', () => {
    const config = {
      tracks: [{ type: 'AlignmentsTrack', trackId: 'track1' }],
    }
    expect(migrateConfigSnapshot(config)).toBe(config)
  })
})
