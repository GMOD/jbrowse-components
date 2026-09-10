/**
 * @jest-environment node
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { configManifest } from './configManifest.generated.ts'
import { configJsonSchema } from './configSchema.generated.ts'
import { configSchemaUrl, schemaProblems } from './schemaValidate.ts'

const REPO_ROOT = path.resolve(__dirname, '../../../../..')

// A config with nothing wrong with it, cloned and broken per-test. Uses the
// `uri` shorthand deliberately: an adapter written that way never mentions the
// `bamLocation` slot it expands to, and reporting it would be the schema's
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
    ] as Record<string, unknown>[],
    tracks: [
      {
        type: 'AlignmentsTrack',
        trackId: 'sample_bam',
        name: 'Sample',
        assemblyNames: ['hg38'],
        adapter: { type: 'BamAdapter', uri: 'sample.bam' } as Record<
          string,
          unknown
        >,
        displays: [] as Record<string, unknown>[],
      } as Record<string, unknown>,
    ],
    defaultSession: {
      name: 'demo',
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

const whereOf = (config: unknown) => schemaProblems(config).map(p => p.where)

function walk(dir: string, name: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? walk(path.join(dir, entry.name), name)
      : entry.name === name
        ? [path.join(dir, entry.name)]
        : [],
  )
}

describe('the schema', () => {
  it('is served at the URL the fences carry', () => {
    expect(configSchemaUrl).toBe(
      'https://jbrowse.org/jb2/schema/v5/config.json',
    )
    expect(configJsonSchema.$id).toBe(configSchemaUrl)
    expect(
      JSON.parse(
        readFileSync(
          path.join(REPO_ROOT, 'website/static/schema/v5/config.json'),
          'utf8',
        ),
      ),
    ).toEqual(configJsonSchema)
  })

  it('accepts a valid config', () => {
    expect(schemaProblems(baseConfig())).toEqual([])
  })

  // The whole reason the validator exists: MST drops undeclared keys without a
  // word, so this is the one class of error nothing else in the stack reports.
  it('reports a misspelt slot, with a suggestion off the schema', () => {
    const config = baseConfig()
    config.tracks[0]!.adapter = {
      type: 'BamAdapter',
      bamLocatoin: { uri: 'x' },
    }
    const [error] = schemaProblems(config)
    expect(error?.where).toBe('tracks[0].adapter.bamLocatoin')
    expect(error?.message).toContain('did you mean "bamLocation"')
  })

  it('reports a wrong slot type', () => {
    const config = baseConfig()
    config.tracks[0]!.displays = [
      { type: 'LinearAlignmentsDisplay', height: 'tall' },
    ]
    const [error] = schemaProblems(config)
    expect(error?.where).toBe('tracks[0].displays[0].height')
    expect(error?.message).toContain('expected a number')
    expect(error?.message).toContain('"jexl:" expression')
  })

  it('accepts a jexl: string where a number is expected', () => {
    const config = baseConfig()
    config.tracks[0]!.displays = [
      { type: 'LinearAlignmentsDisplay', height: 'jexl:100 + 50' },
    ]
    expect(schemaProblems(config)).toEqual([])
  })

  it('accepts anything in a frozen slot', () => {
    const config = baseConfig()
    config.tracks[0]!.displays = [
      {
        type: 'LinearAlignmentsDisplay',
        colorBy: { type: 'tag', tag: 'HP', anything: [1, { deep: true }] },
      },
    ]
    config.tracks[0]!.metadata = 'a string where an object is usual'
    expect(schemaProblems(config)).toEqual([])
  })

  it('accepts an enum value a migration still rewrites', () => {
    const config = baseConfig()
    config.tracks[0] = {
      ...config.tracks[0]!,
      type: 'FeatureTrack',
      adapter: { type: 'Gff3TabixAdapter', uri: 'g.gff.gz' },
      displays: [{ type: 'LinearBasicDisplay', showLabels: false }],
    }
    expect(schemaProblems(config)).toEqual([])
    config.tracks[0].displays = [
      { type: 'LinearBasicDisplay', showLabels: 'sometimes' },
    ]
    expect(whereOf(config)).toEqual(['tracks[0].displays[0].showLabels'])
  })

  it('says a sequenceAdapter on a CRAM track comes from the assembly', () => {
    const config = baseConfig()
    config.tracks[0]!.adapter = {
      type: 'CramAdapter',
      uri: 'sample.cram',
      sequenceAdapter: { type: 'IndexedFastaAdapter', uri: 'hg38.fa' },
    }
    const [error] = schemaProblems(config)
    expect(error?.where).toBe('tracks[0].adapter.sequenceAdapter')
    expect(error?.message).toContain('takes the sequence from the assembly')
    expect(error?.message).not.toContain('did you mean')
  })

  it('says nothing about a _comment key', () => {
    const config = baseConfig()
    config.tracks[0]!._comment_assemblyNames = 'hg19 was here'
    expect(schemaProblems(config)).toEqual([])
  })

  it('accepts the uri shorthand and its csi modifier', () => {
    const config = baseConfig()
    config.tracks[0]!.adapter = { type: 'BamAdapter', uri: 'x.bam', csi: true }
    expect(schemaProblems(config)).toEqual([])
  })

  it('accepts a loose { trackId, uri } track and checks the keys beside it', () => {
    const config = baseConfig()
    config.tracks[0] = { trackId: 'sample_bam', uri: 'sample.bam' }
    expect(schemaProblems(config)).toEqual([])
    config.tracks[0] = {
      type: 'AlignmentsTrack',
      trackId: 'sample_bam',
      uri: 'sample.bam',
      index: 'sample.bam.csi',
      assemblyNames: ['hg38'],
      catgory: ['x'],
    }
    expect(whereOf(config)).toEqual(['tracks[0].catgory'])
  })

  it('requires an adapter or a uri on a typed track', () => {
    const config = baseConfig()
    delete config.tracks[0]!.adapter
    const [error] = schemaProblems(config)
    expect(error?.where).toBe('tracks[0]')
    expect(error?.message).toContain('"adapter"')
    expect(error?.message).toContain('"uri"')
  })

  it('recurses into an adapter sub-schema', () => {
    const config = baseConfig()
    config.tracks[0]!.adapter = {
      type: 'BamAdapter',
      uri: 'sample.bam',
      index: { locatoin: { uri: 'sample.bam.bai' } },
    }
    expect(whereOf(config)).toEqual(['tracks[0].adapter.index.locatoin'])
  })

  it('recurses into each entry of an array of sub-schemas', () => {
    const config = baseConfig()
    config.tracks.push({
      type: 'FeatureTrack',
      trackId: 'scores',
      assemblyNames: ['hg38'],
      adapter: { type: 'BedTabixAdapter', uri: 'scores.bed.gz' },
      displays: [
        {
          type: 'LinearMarkDisplay',
          marks: [
            { shape: 'bar', encoding: { y: 'score' } },
            { shape: 'point', encoding: { colour: 'red' } },
          ],
        },
      ],
    })
    expect(whereOf(config)).toEqual([
      'tracks[1].displays[0].marks[1].encoding.colour',
    ])
  })

  it('checks displayDefaults against the track displays, not the track', () => {
    const config = baseConfig()
    config.tracks[0]!.displayDefaults = { height: 300 }
    expect(schemaProblems(config)).toEqual([])
    config.tracks[0]!.displayDefaults = { heigth: 300 }
    const [error] = schemaProblems(config)
    expect(error?.where).toBe('tracks[0].displayDefaults.heigth')
    expect(error?.message).toContain('did you mean "height"')
  })

  it('opens a track textSearching.textSearchAdapter', () => {
    const config = baseConfig()
    config.tracks[0]!.textSearching = {
      textSearchAdapter: {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: 'a',
        ixFilePth: { uri: 'a.ix' },
      },
    }
    const [error] = schemaProblems(config)
    expect(error?.where).toBe(
      'tracks[0].textSearching.textSearchAdapter.ixFilePth',
    )
    expect(error?.message).toContain('did you mean "ixFilePath"')
  })

  it('accepts the uri shorthand a text search adapter expands', () => {
    const config = baseConfig()
    config.tracks[0]!.textSearching = {
      textSearchAdapter: {
        type: 'TrixTextSearchAdapter',
        uri: 'trix/mytrack.ix',
        assemblyNames: ['hg38'],
      },
    }
    expect(schemaProblems(config)).toEqual([])
  })

  it('opens aggregateTextSearchAdapters and connections', () => {
    const config = {
      ...baseConfig(),
      aggregateTextSearchAdapters: [
        {
          type: 'TrixTextSearchAdapter',
          textSearchAdapterId: 'a',
          ixxFilePth: { uri: 'a.ixx' },
        },
      ],
      connections: [
        {
          type: 'UCSCTrackHubConnection',
          connectionId: 'c',
          hubTxtLocaton: { uri: 'hub.txt' },
        },
      ],
    }
    expect(whereOf(config)).toEqual([
      'aggregateTextSearchAdapters[0].ixxFilePth',
      'connections[0].hubTxtLocaton',
    ])
  })

  it('checks a legacy type name against the type that absorbed it', () => {
    const config = baseConfig()
    config.tracks[0]!.displays = [
      { type: 'LinearPileupDisplay', colorBy: { type: 'strand' } },
    ]
    expect(schemaProblems(config)).toEqual([])
    config.tracks[0]!.displays = [{ type: 'LinearPileupDisplay', bogus: 1 }]
    expect(whereOf(config)).toEqual(['tracks[0].displays[0].bogus'])
  })

  // An unknown type is loud on load (MST throws), and is often a plugin's, so
  // the schema lets it through with its keys unchecked.
  it('passes a type the core plugins do not register', () => {
    const config = baseConfig()
    config.tracks[0]!.adapter = { type: 'MyPluginAdapter', anything: 1 }
    expect(schemaProblems(config)).toEqual([])
  })

  it('reads an assembly written short', () => {
    const config = baseConfig()
    config.assemblies = [
      { name: 'hg38', uri: 'hg38.fa.gz', refNameAliases: { uri: 'aliases' } },
    ]
    expect(schemaProblems(config)).toEqual([])
    config.assemblies = [{ name: 'hg38' }]
    expect(schemaProblems(config)[0]?.message).toContain('"sequence"')
  })

  // A display node inside a session is built by the display's STATE MODEL, so
  // the accepted keys are its MST props — not its config slots, which is the
  // trap: a slot name here reads as obviously right and is dropped in silence.
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
    const [error] = schemaProblems(
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
      schemaProblems(
        sessionDisplay({
          type: 'LinearAlignmentsDisplay',
          configuration: 'sample_bam-LinearAlignmentsDisplay',
          heightPreConfig: 250,
        }),
      ),
    ).toEqual([])
  })

  it('suggests the display prop a misspelled session key meant', () => {
    const [error] = schemaProblems(
      sessionDisplay({ type: 'LinearAlignmentsDisplay', heightPreConfg: 1 }),
    )
    expect(error?.message).toContain('did you mean "heightPreConfig"')
  })

  it('accepts a session display key a migration still lifts', () => {
    expect(
      schemaProblems(
        sessionDisplay({ type: 'LinearAlignmentsDisplay', colorBy: {} }),
      ),
    ).toEqual([])
    expect(
      whereOf(sessionDisplay({ type: 'LinearWiggleDisplay', colorBy: {} })),
    ).toEqual(['defaultSession.views[0].tracks[0].displays[0].colorBy'])
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
                displays: [{ type: 'LinearAlignmentsDisplay', height: 1 }],
              },
            ],
          },
        ],
      },
    ]
    expect(whereOf(config)).toEqual([
      'defaultSession.views[0].views[0].tracks[0].displays[0].height',
    ])
  })

  describe('a session view', () => {
    it('reports a misspelled launch key, with a suggestion', () => {
      const config = baseConfig()
      const view = config.defaultSession.views[0]!
      delete view.assembly
      view.asembly = 'hg38'
      const [error] = schemaProblems(config)
      expect(error?.where).toBe('defaultSession.views[0].asembly')
      expect(error?.message).toContain('did you mean "assembly"')
    })

    it('accepts a launch key and a declared property side by side', () => {
      const config = baseConfig()
      config.defaultSession.views[0]!.showCytobands = false
      expect(schemaProblems(config)).toEqual([])
    })

    it('names the view types a misplaced key belongs to', () => {
      const config = baseConfig()
      config.defaultSession.views = [{ type: 'DotplotView', assembly: 'hg38' }]
      const [error] = schemaProblems(config)
      expect(error?.where).toBe('defaultSession.views[0].assembly')
      expect(error?.message).toContain('is a setting of LinearGenomeView')
      expect(error?.message).toContain('not of DotplotView')
    })

    it('checks the keys under a deprecated init', () => {
      const config = baseConfig()
      config.defaultSession.views = [
        { type: 'LinearGenomeView', init: { assembly: 'hg38', lo: 'chr1' } },
      ]
      expect(whereOf(config)).toEqual(['defaultSession.views[0].init.lo'])
    })

    it('types an inline track entry by the display it opens', () => {
      const config = baseConfig()
      config.defaultSession.views[0]!.tracks = [
        { trackId: 'sample_bam', colorBy: { type: 'strand' }, height: 300 },
      ]
      expect(schemaProblems(config)).toEqual([])
      config.defaultSession.views[0]!.tracks = [
        { trackId: 'sample_bam', type: 'LinearAlignmentsDisplay', hieght: 1 },
      ]
      const [error] = schemaProblems(config)
      expect(error?.where).toBe('defaultSession.views[0].tracks[0].hieght')
      expect(error?.message).toContain('did you mean "height"')
    })

    it('takes the synteny levels form and the circular assembly list', () => {
      const config = baseConfig()
      config.defaultSession.views = [
        {
          type: 'LinearSyntenyView',
          views: [{ assembly: 'hg38' }, { assembly: 'hg38' }],
          tracks: [['sample_bam']],
          levelHeights: [110],
        },
        {
          type: 'CircularView',
          assembly: ['hg38', 'hg38'],
          tracks: ['sample_bam'],
        },
      ]
      expect(schemaProblems(config)).toEqual([])
    })

    it('says nothing about the keys of a view type it does not know', () => {
      const config = baseConfig()
      config.defaultSession.views = [{ type: 'GraphGenomeView', gfa: 'x.gfa' }]
      expect(schemaProblems(config)).toEqual([])
    })
  })

  it('validates a view spec on its own', () => {
    expect(
      schemaProblems(
        { type: 'LinearGenomeView', assembly: 'hg38', tracks: ['x'] },
        '/$defs/View',
      ),
    ).toEqual([])
    expect(
      schemaProblems(
        { type: 'LinearGenomeView', asembly: 'hg38' },
        '/$defs/View',
      ).map(p => p.where),
    ).toEqual(['asembly'])
  })
})

describe('the schema against the tree', () => {
  it.each(walk(path.join(REPO_ROOT, 'test_data'), 'config.json'))(
    'accepts %s',
    file => {
      expect(schemaProblems(JSON.parse(readFileSync(file, 'utf8')))).toEqual([])
    },
  )

  // Every whole config, track and assembly a guide shows. A fence that fails
  // here is either a doc bug or a schema hole, and check-config-blocks.ts
  // reports the same set with the CLI's cross-reference checks on top.
  const fenced: [string, unknown][] = []
  for (const dir of ['website/docs/config_guides', 'website/docs']) {
    for (const entry of readdirSync(path.join(REPO_ROOT, dir))) {
      if (!entry.endsWith('.md')) {
        continue
      }
      const text = readFileSync(path.join(REPO_ROOT, dir, entry), 'utf8')
      for (const [, body] of text.matchAll(/```json[^\n]*\n([\s\S]*?)```/g)) {
        let parsed: unknown
        try {
          parsed = JSON.parse(body!)
        } catch {
          continue
        }
        if (typeof parsed !== 'object' || parsed === null) {
          continue
        }
        const obj = parsed as Record<string, unknown>
        const wrapped = Array.isArray(obj.assemblies)
          ? obj
          : obj.trackId && obj.adapter
            ? { assemblies: [], tracks: [obj] }
            : obj.name && (obj.sequence ?? obj.uri)
              ? { assemblies: [obj] }
              : undefined
        if (wrapped) {
          fenced.push([
            `${dir}/${entry}#${String(obj.trackId ?? obj.name ?? 'config')}`,
            wrapped,
          ])
        }
      }
    }
  }
  it.each(fenced)('accepts the fence %s', (_, config) => {
    expect(schemaProblems(config)).toEqual([])
  })
})

// The manifest and the schema are two walks of the same live objects, so a
// type or a slot one of them has and the other lacks is a generator bug.
describe('the schema and the manifest agree', () => {
  const defs = configJsonSchema.$defs as Record<string, Record<string, unknown>>
  const groups = {
    adapters: configManifest.adapters,
    tracks: configManifest.tracks,
    displays: configManifest.displays,
    textSearchAdapters: configManifest.textSearchAdapters,
    connections: configManifest.connections,
    internetAccounts: configManifest.internetAccounts,
  }

  it('name every config type once each', () => {
    const manifestTypes = Object.values(groups).flatMap(g => Object.keys(g))
    const schemaTypes = Object.keys(defs)
      .filter(name => name.endsWith('Slots'))
      .map(name => name.replace(/Slots$/, ''))
    expect(schemaTypes.sort()).toEqual([...manifestTypes].sort())
    for (const name of manifestTypes) {
      expect(defs[name]).toBeDefined()
    }
  })

  it.each(
    Object.entries(groups).flatMap(([group, types]) =>
      Object.entries(types).map(
        ([name, entry]) => [group, name, entry] as const,
      ),
    ),
  )('%s %s declares the same keys', (group, name, entry) => {
    const slots = new Set([
      ...entry.slots.map(s => s.name),
      ...(entry.shorthandKeys ?? []),
      ...(entry.legacyKeys ?? []),
    ])
    slots.delete('type')
    if (group === 'tracks') {
      slots.add('uri')
      slots.add('index')
      slots.add('displayDefaults')
    }
    const properties = {
      ...(defs[`${name}Slots`]!.properties as Record<string, unknown>),
      ...(defs[name]!.properties as Record<string, unknown>),
    }
    delete properties.type
    expect(Object.keys(properties).sort()).toEqual([...slots].sort())
  })

  it.each(Object.entries(configManifest.views))(
    'view %s declares the same keys',
    (name, entry) => {
      const keys = new Set([
        ...entry.stateModelProps,
        ...entry.launchKeys,
        ...(entry.passThrough ?? []),
      ])
      keys.delete('type')
      const properties = defs[`${name}Keys`]!.properties as Record<
        string,
        unknown
      >
      expect(Object.keys(properties).sort()).toEqual([...keys].sort())
    },
  )

  it.each(Object.entries(configManifest.displays))(
    'display %s declares the same state props',
    (name, entry) => {
      const props = new Set([
        ...(entry.stateModelProps ?? []),
        ...(configManifest.migratedDisplayKeys['*'] ?? []),
        ...(configManifest.migratedDisplayKeys[name] ?? []),
      ])
      const properties = {
        ...(defs[`${name}State`]!.properties as Record<string, unknown>),
        ...(defs[`${name}Snapshot`]!.properties as Record<string, unknown>),
      }
      expect(Object.keys(properties).sort()).toEqual([...props].sort())
    },
  )
})
