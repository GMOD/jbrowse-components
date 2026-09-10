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

  // The settings under it are unwrapped and applied, so the keys inside get
  // the schema's check like the flat ones do — the nesting itself is only a
  // warning.
  it('warns on the nested init form and descends into it', () => {
    const config = baseConfig()
    config.defaultSession.views = [
      { type: 'LinearGenomeView', init: { assembly: 'hg38', lo: 'chr1' } },
    ]
    expect(warningsOf(config).map(w => w.where)).toEqual([
      'defaultSession.views[0].init',
    ])
    expect(warningsOf(config)[0]?.message).toContain('deprecated')
    expect(errorsOf(config).map(e => e.where)).toEqual([
      'defaultSession.views[0].init.lo',
    ])
  })

  it('warns on an enum value a migration still rewrites', () => {
    const config = baseConfig()
    config.tracks[0] = {
      ...config.tracks[0]!,
      type: 'FeatureTrack',
      adapter: { type: 'Gff3TabixAdapter', uri: 'g.gff.gz' },
      // @ts-expect-error the pre-enum boolean
      displays: [{ type: 'LinearBasicDisplay', showLabels: false }],
    }
    expect(errorsOf(config)).toEqual([])
    expect(warningsOf(config)[0]?.message).toContain('legacy value')
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
