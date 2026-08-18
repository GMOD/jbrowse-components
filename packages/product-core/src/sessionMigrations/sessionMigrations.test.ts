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

  // The shape a REAL v4.3.0 session holds. SharedLinearPileupDisplayMixin's
  // preProcessSnapshot renamed an incoming `colorBy` to `colorBySetting` and its
  // postProcessSnapshot wrote that name back out, so a saved session never
  // carries the bare `colorBy` the fixture above uses — which is exactly why
  // this migration silently collected nothing for every real upgrade.
  const releasedNestedAlignmentsView = (trackConfigId: string) => ({
    type: 'LinearGenomeView',
    tracks: [
      {
        type: 'AlignmentsTrack',
        configuration: trackConfigId,
        displays: [
          {
            type: 'LinearAlignmentsDisplay',
            configuration: `${trackConfigId}-LinearAlignmentsDisplay`,
            PileupDisplay: {
              type: 'LinearPileupDisplay',
              configuration: `${trackConfigId}-LinearPileupDisplay`,
              colorBySetting: { type: 'modifications' },
              filterBySetting: { flagInclude: 0, flagExclude: 1540 },
            },
            SNPCoverageDisplay: {
              type: 'LinearSNPCoverageDisplay',
              configuration: `${trackConfigId}-LinearSNPCoverageDisplay`,
            },
          },
        ],
      },
    ],
  })

  test('routes the released colorBySetting/filterBySetting spelling', () => {
    const result = migrateSessionSnapshot({
      name: 'test',
      views: [releasedNestedAlignmentsView('track1')],
    })
    const display = (result.views as any)[0].tracks[0].displays[0]
    expect(display.PileupDisplay).toBeUndefined()
    const deltaDisplay = (result.trackConfigDeltas as any).track1.displays[0]
    expect(deltaDisplay.displayId).toBe('track1-LinearAlignmentsDisplay')
    expect(deltaDisplay.colorBy).toEqual({ type: 'modifications' })
    expect(deltaDisplay.filterBy).toEqual({
      flagInclude: 0,
      flagExclude: 1540,
    })
  })

  // A user who switched the track to "Pileup" / "Read arcs" / … in v4.3.0 has a
  // flat display of that type rather than the nested container, carrying the
  // same settings directly. migrateDisplayType renames it first, so both shapes
  // reach the extractor as a LinearAlignmentsDisplay.
  test('routes settings off a flat old display type', () => {
    const result = migrateSessionSnapshot({
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
                  type: 'LinearReadCloudDisplay',
                  configuration: 'track1-LinearReadCloudDisplay',
                  colorBySetting: { type: 'insertSizeAndOrientation' },
                  trackMaxHeight: 900,
                  jexlFilters: ["jexl:get(feature,'flags')==99"],
                  hideMismatchesSetting: true,
                },
              ],
            },
          ],
        },
      ],
    })
    const display = (result.views as any)[0].tracks[0].displays[0]
    expect(display.type).toBe('LinearAlignmentsDisplay')
    // regression: the band settings used to be merged onto the instance, where
    // they are config slots the state model does not declare — MST dropped all
    // three on load and the arcs/cloud track opened as a full pileup + coverage
    expect(display.readConnections).toBeUndefined()
    expect(display.showPileup).toBeUndefined()
    expect(display.showCoverage).toBeUndefined()
    expect(display.colorBySetting).toBeUndefined()
    expect(display.trackMaxHeight).toBeUndefined()
    expect(display.jexlFilters).toBeUndefined()
    expect(display.hideMismatchesSetting).toBeUndefined()

    const deltaDisplay = (result.trackConfigDeltas as any).track1.displays[0]
    expect(deltaDisplay.displayId).toBe('track1-LinearReadCloudDisplay')
    // the compensation for the type collapse lands on the config, beside the
    // settings the extractor lifted
    expect(deltaDisplay.readConnections).toBe('cloud')
    expect(deltaDisplay.showPileup).toBe(false)
    expect(deltaDisplay.showCoverage).toBe(false)
    expect(deltaDisplay.colorBy).toEqual({ type: 'insertSizeAndOrientation' })
    expect(deltaDisplay.maxHeight).toBe(900)
    expect(deltaDisplay.jexlFilters).toEqual(["jexl:get(feature,'flags')==99"])
    // hideMismatches inverts into the showMismatches slot that replaced it
    expect(deltaDisplay.showMismatches).toBe(false)
  })

  // The commonest way to have one of these displays at all: a BAM from an admin
  // config, switched to Read arcs in v4.3.0 and saved. There is no sessionTrack
  // and no other per-instance setting, so this display reaches the migration
  // with nothing but its type — and the compensation still has to land.
  test('routes the collapse compensation for a display carrying nothing else', () => {
    const result = migrateSessionSnapshot({
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
                  type: 'LinearReadArcsDisplay',
                  configuration: 'track1-LinearReadArcsDisplay',
                },
              ],
            },
          ],
        },
      ],
    })
    const deltaDisplay = (result.trackConfigDeltas as any).track1.displays[0]
    expect(deltaDisplay.displayId).toBe('track1-LinearReadArcsDisplay')
    expect(deltaDisplay.type).toBe('LinearAlignmentsDisplay')
    expect(deltaDisplay.readConnections).toBe('arc')
    expect(deltaDisplay.showPileup).toBe(false)
    expect(deltaDisplay.showCoverage).toBe(false)
  })

  // The config path runs the same extractor, and there `colorBy` is the live
  // slot — lifting it off a track's display config would strip a working config.
  test('leaves colorBy alone on a config display node', () => {
    const result = migrateConfigSnapshot({
      tracks: [
        {
          trackId: 'track1',
          type: 'AlignmentsTrack',
          displays: [
            {
              type: 'LinearPileupDisplay',
              displayId: 'track1-LinearPileupDisplay',
              colorBy: { type: 'modifications' },
              jexlFilters: ["jexl:get(feature,'flags')==99"],
            },
          ],
        },
      ],
    })
    const display = (result.tracks as any)[0].displays[0]
    expect(display.type).toBe('LinearAlignmentsDisplay')
    expect(display.colorBy).toEqual({ type: 'modifications' })
    expect(display.jexlFilters).toEqual(["jexl:get(feature,'flags')==99"])
    expect(result.trackConfigDeltas).toBeUndefined()
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

  // A flat LinearAlignmentsDisplay with no sub-nodes still needs the lift: the
  // display has no `colorBy` prop, only a `colorBy` slot, so a key sitting here
  // is dropped by MST on load and the session opens colored `normal`. Both
  // spellings, because a hand-authored snapshot (test_data/methylation_test) may
  // use either.
  test.each(['colorBy', 'colorBySetting'])(
    'lifts %s off a flat LinearAlignmentsDisplay instance',
    key => {
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
                    [key]: { type: 'methylation' },
                  },
                ],
              },
            ],
          },
        ],
      }
      const result = migrateSessionSnapshot(snap)
      const display = (result.views as any)[0].tracks[0].displays[0]
      expect(display[key]).toBeUndefined()
      const deltaDisplay = (result.trackConfigDeltas as any).track1.displays[0]
      expect(deltaDisplay.colorBy).toEqual({ type: 'methylation' })
    },
  )

  test('leaves a display instance with only live props untouched', () => {
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
    // pileup-only display had no coverage band
    expect(display.showCoverage).toBe(false)
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
    const display = (result.tracks as any)[0].displays[0]
    expect(display.type).toBe('LinearAlignmentsDisplay')
    expect(display.showPileup).toBe(false)
    expect(display.coverageHeight).toBe(100)
    expect(display.height).toBe(100)
  })

  test('carries arcs/cloud intent onto readConnections', () => {
    const config = {
      tracks: [
        {
          trackId: 'track1',
          displays: [
            { type: 'LinearReadArcsDisplay', displayId: 'd1' },
            { type: 'LinearReadCloudDisplay', displayId: 'd2' },
          ],
        },
      ],
    }
    const [arcs, cloud] = (migrateConfigSnapshot(config).tracks as any)[0]
      .displays
    expect(arcs.readConnections).toBe('arc')
    expect(cloud.readConnections).toBe('cloud')
    for (const d of [arcs, cloud]) {
      expect(d.showPileup).toBe(false)
      expect(d.showCoverage).toBe(false)
    }
  })

  test('an explicit author value wins over the carried-over setting', () => {
    const config = {
      tracks: [
        {
          trackId: 'track1',
          displays: [
            {
              type: 'LinearSNPCoverageDisplay',
              displayId: 'd1',
              showPileup: true,
              height: 400,
            },
          ],
        },
      ],
    }
    const display = (migrateConfigSnapshot(config).tracks as any)[0].displays[0]
    expect(display.showPileup).toBe(true)
    expect(display.height).toBe(400)
    expect(display.coverageHeight).toBe(100)
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
