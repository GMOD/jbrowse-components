/**
 * @jest-environment node
 */
import { validateConfig } from './validateConfig.ts'

// A config with nothing wrong with it, cloned and broken per-test. Uses the
// `uri` shorthand deliberately: an adapter written that way never mentions the
// `bamLocation` slot it expands to, and reporting it would be the validator's
// worst failure mode.
function baseConfig() {
  return {
    assemblies: [
      {
        name: 'hg38',
        aliases: ['GRCh38'],
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'hg38-ref',
          adapter: { type: 'BgzipFastaAdapter', uri: 'hg38.fa.gz' },
        },
      },
    ],
    tracks: [
      {
        type: 'AlignmentsTrack',
        trackId: 'sample_bam',
        name: 'Sample',
        assemblyNames: ['hg38'],
        adapter: { type: 'BamAdapter', uri: 'sample.bam' },
      },
    ],
    defaultSession: {
      name: 'demo',
      // A v5 view takes every setting flat, and the tests below swap this whole
      // entry for other view types and shapes, so the element type is the JSON
      // an author writes rather than this one view's.
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:1-1000',
          tracks: ['sample_bam'],
        },
      ] as Record<string, unknown>[],
    },
  }
}

const errorsOf = (config: unknown) =>
  validateConfig(config).problems.filter(p => p.level === 'error')
const warningsOf = (config: unknown) =>
  validateConfig(config).problems.filter(p => p.level === 'warning')

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    expect(validateConfig(baseConfig()).problems).toEqual([])
  })

  // The whole reason the command exists: MST drops undeclared keys without a
  // word, so this is the one class of error nothing else in the stack reports.
  it('reports an unknown adapter slot, with a suggestion', () => {
    const config = baseConfig()
    // @ts-expect-error deliberately misspelled
    config.tracks[0]!.adapter.bamLocatoin = { uri: 'sample.bam' }
    const [error] = errorsOf(config)
    expect(error?.where).toBe('tracks[0].adapter.bamLocatoin')
    expect(error?.message).toContain('did you mean "bamLocation"')
  })

  // A key that is spelled correctly and belongs to no schema, because JBrowse
  // fills it in for itself. The generic message sends the author hunting for a
  // typo; two tracks in the hg002 demo carried one for a year.
  it('says a sequenceAdapter on a CRAM track comes from the assembly', () => {
    const config = baseConfig()
    config.tracks[0]!.adapter = {
      type: 'CramAdapter',
      uri: 'sample.cram',
      // @ts-expect-error the point of the test: CramAdapter declares no such slot
      sequenceAdapter: { type: 'IndexedFastaAdapter', uri: 'hg38.fa' },
    }
    const [error] = errorsOf(config)
    expect(error?.where).toBe('tracks[0].adapter.sequenceAdapter')
    expect(error?.message).toContain('takes the sequence from the assembly')
    expect(error?.message).not.toContain('did you mean')
  })

  // The other half. Where the slot IS declared the config works, so this is a
  // warning rather than an error — but writing one by hand is still backwards,
  // and three configs here were copying their own assembly's FASTA urls into a
  // GC track.
  it('warns when a declared sequenceAdapter is set by hand', () => {
    const config = baseConfig()
    config.tracks[0]!.type = 'QuantitativeTrack'
    config.tracks[0]!.adapter = {
      type: 'GCContentAdapter',
      // @ts-expect-error a declared slot on this adapter
      sequenceAdapter: { type: 'BgzipFastaAdapter', uri: 'hg38.fa.gz' },
    }
    expect(errorsOf(config)).toEqual([])
    const [warning] = warningsOf(config)
    expect(warning?.where).toBe('tracks[0].adapter.sequenceAdapter')
    expect(warning?.message).toContain(
      'only needed to read some OTHER sequence',
    )
  })

  // A GC track needs nothing but its type now, which is the shape the warning
  // above is steering authors towards.
  it('accepts a GC content track with no sequenceAdapter at all', () => {
    const config = baseConfig()
    config.tracks[0]!.type = 'QuantitativeTrack'
    // @ts-expect-error the point of the test: this adapter needs no other key
    config.tracks[0]!.adapter = { type: 'GCContentAdapter' }
    expect(validateConfig(config).problems).toEqual([])
  })

  // JSON has no comments, so an author annotating a config reaches for a key
  // like this. MST drops it, which is what they wanted.
  it('says nothing about a _comment key', () => {
    const config = baseConfig()
    // @ts-expect-error deliberately not a slot
    config.tracks[0]!._comment_assemblyNames = 'hg19 was here'
    expect(validateConfig(config).problems).toEqual([])
  })

  it('reports an unknown display slot', () => {
    const config = baseConfig()
    // @ts-expect-error deliberately unknown
    config.tracks[0]!.displays = [
      { type: 'LinearAlignmentsDisplay', displayId: 'd', notASlot: 1 },
    ]
    expect(errorsOf(config).map(e => e.where)).toEqual([
      'tracks[0].displays[0].notASlot',
    ])
  })

  it('accepts the uri shorthand and its csi modifier', () => {
    const config = baseConfig()
    config.tracks[0]!.adapter = {
      type: 'BamAdapter',
      uri: 'sample.bam',
      // @ts-expect-error shorthand, not a declared slot
      csi: true,
    }
    expect(errorsOf(config)).toEqual([])
  })

  it('accepts a loose { trackId, uri } track, assembly implied by the one assembly', () => {
    const config = baseConfig()
    // @ts-expect-error the loose form declares neither type nor adapter
    config.tracks[0] = { trackId: 'sample_bam', uri: 'sample.bam' }
    expect(errorsOf(config)).toEqual([])
  })

  it('a loose track still has to name its assembly among several', () => {
    const config = baseConfig()
    config.assemblies.push({ ...config.assemblies[0]!, name: 'hg19' })
    // @ts-expect-error the loose form declares neither type nor adapter
    config.tracks[0] = { trackId: 'sample_bam', uri: 'sample.bam' }
    expect(errorsOf(config).map(e => e.where)).toEqual([
      'tracks[0].assemblyNames',
    ])
  })

  it('checks the keys written beside a loose track uri', () => {
    const config = baseConfig()
    config.tracks[0] = {
      type: 'AlignmentsTrack',
      trackId: 'sample_bam',
      // @ts-expect-error the loose form declares no adapter
      uri: 'sample.bam',
      index: 'sample.bam.csi',
      assemblyNames: ['hg38'],
      catgory: ['x'],
    }
    expect(errorsOf(config).map(e => e.where)).toEqual(['tracks[0].catgory'])
  })

  it('recurses into an adapter sub-schema', () => {
    const config = baseConfig()
    config.tracks[0]!.adapter = {
      type: 'BamAdapter',
      uri: 'sample.bam',
      // @ts-expect-error deliberately misspelled inside the sub-schema
      index: { locatoin: { uri: 'sample.bam.bai' } },
    }
    expect(errorsOf(config).map(e => e.where)).toEqual([
      'tracks[0].adapter.index.locatoin',
    ])
  })

  it('resolves an assembly alias', () => {
    const config = baseConfig()
    config.tracks[0]!.assemblyNames = ['GRCh38']
    expect(errorsOf(config)).toEqual([])
  })

  it('reports a track naming an undefined assembly', () => {
    const config = baseConfig()
    config.tracks[0]!.assemblyNames = ['hg19']
    const [error] = errorsOf(config)
    expect(error?.where).toBe('tracks[0].assemblyNames')
    expect(error?.message).toContain('did you mean "hg38"')
  })

  it('reports a duplicate trackId', () => {
    const config = baseConfig()
    config.tracks.push({ ...config.tracks[0]! })
    expect(errorsOf(config).map(e => e.where)).toEqual(['tracks[1].trackId'])
  })

  it('reports a defaultSession naming a track that does not exist', () => {
    const config = baseConfig()
    config.defaultSession.views[0]!.tracks = ['sample_bem']
    const [error] = errorsOf(config)
    expect(error?.where).toBe('defaultSession.views[0].tracks[0]')
    expect(error?.message).toContain('did you mean "sample_bam"')
  })

  // Same trap as a session display node, one level up: a view has no config
  // schema at all, so its declared MST properties plus its registered launch
  // keys are the whole accepted set and everything else is dropped in silence.
  // Four artifacts shipped broken this way.
  describe('a session view', () => {
    it('reports a misspelled launch key, with a suggestion', () => {
      const config = baseConfig()
      const view = config.defaultSession.views[0]!
      delete view.assembly
      view.asembly = 'hg38'
      const [error] = errorsOf(config)
      expect(error?.where).toBe('defaultSession.views[0].asembly')
      expect(error?.message).toContain('did you mean "assembly"')
    })

    it('accepts a launch key and a declared property side by side', () => {
      const config = baseConfig()
      config.defaultSession.views[0]!.showCytobands = false
      expect(validateConfig(config).problems).toEqual([])
    })

    // The key is real and correctly spelled, so no suggestion reaches it —
    // naming the views that do take it is the only useful thing to say.
    it('names the view types a misplaced key belongs to', () => {
      const config = baseConfig()
      config.defaultSession.views = [{ type: 'DotplotView', assembly: 'hg38' }]
      const [error] = errorsOf(config)
      expect(error?.where).toBe('defaultSession.views[0].assembly')
      expect(error?.message).toContain('is a setting of LinearGenomeView')
      expect(error?.message).toContain('not of DotplotView')
    })

    // Nothing reads what is under it, so the keys inside are not reported: a
    // list of them would describe settings that arrive nowhere.
    it('errors on the nested init form and does not descend', () => {
      const config = baseConfig()
      config.defaultSession.views = [
        { type: 'LinearGenomeView', init: { assembly: 'hg38', lo: 'chr1' } },
      ]
      expect(errorsOf(config).map(e => e.where)).toEqual([
        'defaultSession.views[0].init',
      ])
      expect(errorsOf(config)[0]?.message).toContain('v5 removed')
    })

    it('checks a row of a comparative view as a view of its own', () => {
      const config = baseConfig()
      config.defaultSession.views = [
        {
          type: 'LinearSyntenyView',
          views: [{ type: 'LinearGenomeView', asembly: 'hg38' }],
        },
      ]
      expect(errorsOf(config).map(e => e.where)).toEqual([
        'defaultSession.views[0].views[0].asembly',
      ])
    })

    // A plugin's view type is a warning from resolveType and nothing more: its
    // keys are unknowable from this manifest.
    it('says nothing about the keys of a view type it does not know', () => {
      const config = baseConfig()
      config.defaultSession.views = [{ type: 'GraphGenomeView', gfa: 'x.gfa' }]
      expect(errorsOf(config)).toEqual([])
    })
  })

  it('checks displayDefaults against the track displays, not the track', () => {
    const config = baseConfig()
    // @ts-expect-error shorthand, not a declared track slot
    config.tracks[0]!.displayDefaults = { height: 300 }
    expect(errorsOf(config)).toEqual([])

    // @ts-expect-error deliberately misspelled
    config.tracks[0]!.displayDefaults = { heigth: 300 }
    const [error] = errorsOf(config)
    expect(error?.where).toBe('tracks[0].displayDefaults.heigth')
    expect(error?.message).toContain('did you mean "height"')
  })

  // A Trix path typo is a search that returns nothing, which is the class of
  // mistake the command exists for — and the three surfaces below were never
  // opened, so all of them passed with a deliberate typo in them.
  it('opens a track textSearching.textSearchAdapter', () => {
    const config = baseConfig()
    // @ts-expect-error deliberately misspelled
    config.tracks[0]!.textSearching = {
      textSearchAdapter: {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: 'a',
        ixFilePth: { uri: 'a.ix' },
      },
    }
    const [error] = errorsOf(config)
    expect(error?.where).toBe(
      'tracks[0].textSearching.textSearchAdapter.ixFilePth',
    )
    expect(error?.message).toContain('did you mean "ixFilePath"')
  })

  it('opens aggregateTextSearchAdapters', () => {
    const config = baseConfig()
    // @ts-expect-error deliberately misspelled
    config.aggregateTextSearchAdapters = [
      {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: 'a',
        assemblyNames: ['hg38'],
        ixxFilePth: { uri: 'a.ixx' },
      },
    ]
    const [error] = errorsOf(config)
    expect(error?.where).toBe('aggregateTextSearchAdapters[0].ixxFilePth')
    expect(error?.message).toContain('did you mean "ixxFilePath"')
  })

  // TrixTextSearchAdapter's preProcessSnapshot derives all three locations from
  // one `uri`, which is how every doc writes it — the manifest recorded
  // shorthands for the `adapters` group only, so opening this one at all
  // reported the documented form as three unknown slots
  it('accepts the uri shorthand a text search adapter expands', () => {
    const config = baseConfig()
    // @ts-expect-error shorthand, not a declared slot
    config.tracks[0]!.textSearching = {
      textSearchAdapter: {
        type: 'TrixTextSearchAdapter',
        uri: 'trix/mytrack.ix',
        assemblyNames: ['hg38'],
      },
    }
    expect(validateConfig(config).problems).toEqual([])
  })

  it('opens connections', () => {
    const config = baseConfig()
    // @ts-expect-error deliberately misspelled
    config.connections = [
      {
        type: 'UCSCTrackHubConnection',
        connectionId: 'c',
        name: 'hub',
        hubTxtLocaton: { uri: 'hub.txt' },
      },
    ]
    const [error] = errorsOf(config)
    expect(error?.where).toBe('connections[0].hubTxtLocaton')
    expect(error?.message).toContain('did you mean "hubTxtLocation"')
  })

  // test_data/volvox's config.json has a track on an assembly a
  // JB2TrackHubConnection supplies onto a *second* config file, added at
  // runtime — so no validator reading this one can resolve it, and leading with
  // `did you mean "volvox_del"?` called a working config a typo.
  it('names the connection possibility before the spelling guess', () => {
    const config = baseConfig()
    config.assemblies[0]!.aliases = ['volvox_del']
    config.tracks[0]!.assemblyNames = ['volvox_del2']
    const [error] = errorsOf(config)
    expect(error?.where).toBe('tracks[0].assemblyNames')
    expect(error?.message).toContain('a connection added at runtime can')
    expect(error?.message.indexOf('connection')).toBeLessThan(
      error!.message.indexOf('did you mean'),
    )
  })

  // An unknown type is loud on load (MST throws), and is often a plugin's, so
  // it must never fail the run the way a silently-dropped slot does.
  it('warns rather than errors on an unrecognized type', () => {
    const config = baseConfig()
    config.tracks[0]!.adapter = { type: 'Gff3TabixAdaptor', uri: 'g.gff.gz' }
    expect(errorsOf(config)).toEqual([])
    const [warning] = warningsOf(config)
    expect(warning?.message).toContain('did you mean "Gff3TabixAdapter"')
  })

  it('checks a legacy display type against the type that absorbed it', () => {
    const config = baseConfig()
    // @ts-expect-error alias of LinearAlignmentsDisplay
    config.tracks[0]!.displays = [
      {
        type: 'LinearPileupDisplay',
        displayId: 'd',
        colorBy: { type: 'strand' },
      },
    ]
    expect(validateConfig(config).problems).toEqual([])
  })

  // `renderer` is lifted into current slots by LinearBasicDisplay, and silently
  // dropped by LinearWiggleDisplay. Same key, different verdict — which is why
  // the manifest records it per type rather than globally.
  it('distinguishes a migrated legacy key from a dropped one', () => {
    const withBasic = baseConfig()
    withBasic.tracks[0] = {
      ...withBasic.tracks[0]!,
      type: 'FeatureTrack',
      adapter: { type: 'Gff3TabixAdapter', uri: 'g.gff.gz' },
      // @ts-expect-error legacy key
      displays: [
        {
          type: 'LinearBasicDisplay',
          displayId: 'd',
          renderer: { color1: 'red' },
        },
      ],
    }
    expect(errorsOf(withBasic)).toEqual([])
    expect(warningsOf(withBasic)[0]?.where).toBe(
      'tracks[0].displays[0].renderer',
    )

    const withWiggle = baseConfig()
    withWiggle.tracks[0] = {
      ...withWiggle.tracks[0]!,
      type: 'QuantitativeTrack',
      adapter: { type: 'BigWigAdapter', uri: 'x.bw' },
      // @ts-expect-error dropped, not migrated, on this display
      displays: [
        {
          type: 'LinearWiggleDisplay',
          displayId: 'd',
          renderer: { color: 'red' },
        },
      ],
    }
    expect(errorsOf(withWiggle).map(e => e.where)).toEqual([
      'tracks[0].displays[0].renderer',
    ])
  })

  // A display node inside a session is built by the display's STATE MODEL, so
  // the accepted keys are its MST props — not its config slots, which is the
  // trap: a slot name here reads as obviously right and is dropped in silence.
  // Every case below was found sitting in this repo's own fixtures.
  function sessionDisplay(display: Record<string, unknown>) {
    const config = baseConfig()
    config.defaultSession.views = [
      {
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'AlignmentsTrack',
            configuration: 'sample_bam',
            displays: [display],
          },
        ],
      },
    ]
    return config
  }

  it('reports a config slot written on a session display node', () => {
    const [error] = errorsOf(
      sessionDisplay({
        type: 'LinearAlignmentsDisplay',
        configuration: 'sample_bam-LinearAlignmentsDisplay',
        height: 250,
      }),
    )
    expect(error?.where).toBe(
      'defaultSession.views[0].tracks[0].displays[0].height',
    )
    expect(error?.message).toContain('config slot, not a display property')
  })

  it('accepts a real display prop on a session display node', () => {
    expect(
      errorsOf(
        sessionDisplay({
          type: 'LinearBasicDisplay',
          configuration: 'sample_bam-LinearBasicDisplay',
          pinnedFeatureIds: ['feat1'],
        }),
      ),
    ).toEqual([])
  })

  it('suggests the display prop a misspelled session key meant', () => {
    const [error] = errorsOf(
      sessionDisplay({
        type: 'LinearBasicDisplay',
        configuration: 'sample_bam-LinearBasicDisplay',
        trackDisplayMode: 'compact',
      }),
    )
    expect(error?.message).toContain('did you mean "displayMode"')
  })

  // Stale but working, so a warning — and scoped to the display type the
  // migration actually covers, since `jexlFilters` is lifted for the alignments
  // display and simply dead on a LinearBasicDisplay (whose prop is
  // `jexlFiltersSetting`).
  it('warns rather than errors on a key a session migration still lifts', () => {
    const config = sessionDisplay({
      type: 'LinearAlignmentsDisplay',
      configuration: 'sample_bam-LinearAlignmentsDisplay',
      colorBySetting: { type: 'modifications' },
    })
    expect(errorsOf(config)).toEqual([])
    expect(warningsOf(config)[0]?.message).toContain('legacy display-instance')
  })

  it('errors on a migrated key of another display type', () => {
    const [error] = errorsOf(
      sessionDisplay({
        type: 'LinearBasicDisplay',
        configuration: 'sample_bam-LinearBasicDisplay',
        jexlFilters: ["jexl:feature.type=='gene'"],
      }),
    )
    expect(error?.message).toContain('config slot, not a display property')
  })

  // An old display type resolves through its alias, so the props checked are
  // the absorbing type's — the ones the snapshot will actually be built with.
  it('checks an old display type against the type that absorbed it', () => {
    const config = sessionDisplay({
      type: 'LinearPileupDisplay',
      configuration: 'sample_bam-LinearPileupDisplay',
      colorBySetting: { type: 'modifications' },
    })
    expect(errorsOf(config)).toEqual([])
  })

  it('checks displays inside a session sub-view', () => {
    const config = baseConfig()
    config.defaultSession.views = [
      {
        type: 'LinearSyntenyView',
        views: [
          {
            type: 'LinearGenomeView',
            tracks: [
              {
                type: 'AlignmentsTrack',
                configuration: 'sample_bam',
                displays: [
                  {
                    type: 'LinearAlignmentsDisplay',
                    configuration: 'sample_bam-LinearAlignmentsDisplay',
                    notAProp: 1,
                  },
                ],
              },
            ],
          },
        ],
      },
    ]
    expect(errorsOf(config).map(e => e.where)).toEqual([
      'defaultSession.views[0].views[0].tracks[0].displays[0].notAProp',
    ])
  })

  it('notes that plugin-registered types cannot be checked', () => {
    const config = { ...baseConfig(), plugins: [{ name: 'X', umdUrl: 'x.js' }] }
    expect(validateConfig(config).notes[0]).toContain('plugin(s)')
  })

  it('reports a config with no assemblies', () => {
    expect(errorsOf({ tracks: [] }).map(e => e.where)).toContain('assemblies')
  })

  it('reports a non-object config rather than throwing', () => {
    expect(errorsOf('not a config')).toHaveLength(1)
  })
})
