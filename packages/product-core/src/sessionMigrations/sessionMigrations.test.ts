import { migrateConfigSnapshot, migrateSessionSnapshot } from './index.ts'

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

  test('migrates trackConfigDeltas display types', () => {
    const snap = {
      name: 'test',
      views: [],
      trackConfigDeltas: {
        track1: {
          trackId: 'track1',
          displays: [{ type: 'LinearPileupDisplay', displayId: 'track1-d1' }],
        },
      },
    }
    const result = migrateSessionSnapshot(snap)
    const display = (result.trackConfigDeltas as any).track1.displays[0]
    expect(display.type).toBe('LinearAlignmentsDisplay')
  })

  test('leaves a trackConfigDeltas entry without a stale display type untouched', () => {
    const snap = {
      name: 'test',
      views: [],
      trackConfigDeltas: {
        track1: {
          trackId: 'track1',
          displays: [{ displayId: 'track1-d1', height: 321 }],
        },
      },
    }
    // no stale types anywhere → identity returned (no needless churn)
    expect(migrateSessionSnapshot(snap)).toBe(snap)
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

  // Pre-4.x nested LinearAlignmentsDisplay container: colorBy/filterBy lived on
  // nested PileupDisplay/SNPCoverageDisplay sub-nodes, now config slots.
  const nestedAlignmentsView = (trackConfigId: string) => ({
    type: 'LinearGenomeView',
    tracks: [
      {
        type: 'AlignmentsTrack',
        configuration: trackConfigId,
        displays: [
          {
            type: 'LinearAlignmentsDisplay',
            configuration: `${trackConfigId}-LinearAlignmentsDisplay`,
            height: 250,
            PileupDisplay: {
              type: 'LinearPileupDisplay',
              colorBy: { type: 'modifications' },
              filterBy: { flagInclude: 0, flagExclude: 1536 },
            },
            SNPCoverageDisplay: {
              type: 'LinearSNPCoverageDisplay',
              colorBy: { type: 'modifications' },
            },
          },
        ],
      },
    ],
  })

  test('routes nested colorBy on an admin base track into trackConfigDeltas', () => {
    const snap = {
      name: 'test',
      views: [nestedAlignmentsView('track1')],
    }
    const result = migrateSessionSnapshot(snap)
    const display = (result.views as any)[0].tracks[0].displays[0]
    // dead sub-nodes stripped off the instance
    expect(display.PileupDisplay).toBeUndefined()
    expect(display.SNPCoverageDisplay).toBeUndefined()
    expect(display.height).toBe(250)
    // settings landed as a delta keyed by trackId, merged by displayId
    const delta = (result.trackConfigDeltas as any).track1
    expect(delta.trackId).toBe('track1')
    const deltaDisplay = delta.displays[0]
    expect(deltaDisplay.displayId).toBe('track1-LinearAlignmentsDisplay')
    expect(deltaDisplay.colorBy).toEqual({ type: 'modifications' })
    expect(deltaDisplay.filterBy).toEqual({ flagInclude: 0, flagExclude: 1536 })
  })

  test('routes nested colorBy on a sessionTrack into its display config in place', () => {
    const snap = {
      name: 'test',
      views: [nestedAlignmentsView('session-track-1')],
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'session-track-1',
          displays: [
            {
              type: 'LinearAlignmentsDisplay',
              displayId: 'session-track-1-LinearAlignmentsDisplay',
            },
          ],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    // no delta for a user-added track — edited in place
    expect(result.trackConfigDeltas).toBeUndefined()
    const display = (result.sessionTracks as any)[0].displays[0]
    expect(display.colorBy).toEqual({ type: 'modifications' })
    expect(display.filterBy).toEqual({ flagInclude: 0, flagExclude: 1536 })
  })

  test('merges nested colorBy into an existing trackConfigDeltas entry', () => {
    const snap = {
      name: 'test',
      views: [nestedAlignmentsView('track1')],
      trackConfigDeltas: {
        track1: {
          trackId: 'track1',
          displays: [
            { displayId: 'track1-LinearAlignmentsDisplay', height: 321 },
          ],
        },
      },
    }
    const result = migrateSessionSnapshot(snap)
    const deltaDisplay = (result.trackConfigDeltas as any).track1.displays[0]
    expect(deltaDisplay.height).toBe(321)
    expect(deltaDisplay.colorBy).toEqual({ type: 'modifications' })
  })

  test('routes legacy heightPreConfig onto the height slot as a trackConfigDelta', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              type: 'AlignmentsTrack',
              configuration: 'track1',
              displays: [
                {
                  type: 'LinearAlignmentsDisplay',
                  configuration: 'track1-LinearAlignmentsDisplay',
                  heightPreConfig: 88,
                },
              ],
            },
          ],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    const display = (result.views as any)[0].tracks[0].displays[0]
    // dead prop stripped off the instance
    expect(display.heightPreConfig).toBeUndefined()
    const deltaDisplay = (result.trackConfigDeltas as any).track1.displays[0]
    expect(deltaDisplay.displayId).toBe('track1-LinearAlignmentsDisplay')
    expect(deltaDisplay.type).toBe('LinearAlignmentsDisplay')
    expect(deltaDisplay.height).toBe(88)
  })

  test('routes heightPreConfig preserving a non-alignments display type', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [],
          views: [
            {
              type: 'LinearGenomeView',
              tracks: [
                {
                  type: 'SyntenyTrack',
                  configuration: 'synteny1',
                  displays: [
                    {
                      type: 'LGVSyntenyDisplay',
                      configuration: 'synteny1-LGVSyntenyDisplay',
                      heightPreConfig: 52,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    const deltaDisplay = (result.trackConfigDeltas as any).synteny1.displays[0]
    // synthesized delta display carries the real type, not a hardcoded default
    expect(deltaDisplay.type).toBe('LGVSyntenyDisplay')
    expect(deltaDisplay.height).toBe(52)
  })

  test('last panel wins when a shared display config appears in two synteny panels', () => {
    const syntenyDisplay = (h: number) => ({
      type: 'LGVSyntenyDisplay',
      configuration: 'synteny1-LGVSyntenyDisplay',
      heightPreConfig: h,
    })
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [],
          views: [
            {
              type: 'LinearGenomeView',
              tracks: [
                {
                  type: 'SyntenyTrack',
                  configuration: 'synteny1',
                  displays: [syntenyDisplay(28)],
                },
              ],
            },
            {
              type: 'LinearGenomeView',
              tracks: [
                {
                  type: 'SyntenyTrack',
                  configuration: 'synteny1',
                  displays: [syntenyDisplay(52)],
                },
              ],
            },
          ],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    const deltaDisplay = (result.trackConfigDeltas as any).synteny1.displays[0]
    expect(deltaDisplay.height).toBe(52)
  })

  test('routes heightPreConfig on a sessionTrack display in place', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              type: 'AlignmentsTrack',
              configuration: 'session-track-1',
              displays: [
                {
                  type: 'LinearAlignmentsDisplay',
                  configuration: 'session-track-1-LinearAlignmentsDisplay',
                  heightPreConfig: 120,
                },
              ],
            },
          ],
        },
      ],
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'session-track-1',
          displays: [
            {
              type: 'LinearAlignmentsDisplay',
              displayId: 'session-track-1-LinearAlignmentsDisplay',
            },
          ],
        },
      ],
    }
    const result = migrateSessionSnapshot(snap)
    expect(result.trackConfigDeltas).toBeUndefined()
    const display = (result.sessionTracks as any)[0].displays[0]
    expect(display.height).toBe(120)
  })

  test('leaves a flat LinearAlignmentsDisplay (no nested sub-nodes) untouched', () => {
    const snap = {
      name: 'test',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              type: 'AlignmentsTrack',
              configuration: 'track1',
              displays: [
                {
                  type: 'LinearAlignmentsDisplay',
                  configuration: 'track1-LinearAlignmentsDisplay',
                  colorBy: { type: 'methylation' },
                },
              ],
            },
          ],
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
