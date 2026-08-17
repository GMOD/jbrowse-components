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
      views: [
        {
          type: 'LinearGenomeView',
          init: {
            assembly: 'hg38',
            loc: 'chr1:1-1000',
            tracks: ['sample_bam'],
          },
        },
      ],
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
    config.defaultSession.views[0]!.init.tracks = ['sample_bem']
    const [error] = errorsOf(config)
    expect(error?.where).toBe('defaultSession.views[0].init.tracks[0]')
    expect(error?.message).toContain('did you mean "sample_bam"')
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
        // @ts-expect-error the snapshot form, alongside the spec form above
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
        // @ts-expect-error a synteny view holds a row of LGVs
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
