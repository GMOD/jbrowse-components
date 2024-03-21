/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

import { setup, ctxDir, dataDir, readConf, readConfAlt } from '../testUtil'

const { rename, copyFile, writeFile, mkdir } = fs.promises

const defaultConfig = {
  assemblies: [],
  configuration: {},
  connections: [],
  defaultSession: {
    name: 'New Session',
  },
  tracks: [],
}

const baseAssembly = { name: 'simple', sequence: {} }
const baseSequence = {
  adapter: {},
  trackId: 'simple-ReferenceSequenceTrack',
  type: 'ReferenceSequenceTrack',
}

// Cleaning up exitCode in Node.js 20, xref https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

describe('add-assembly', () => {
  setup
    .command(['add-assembly', '{}'])
    .exit(110)
    .it('fails if no load flag is passed')

  setup
    .command(['add-assembly', '{}', '--load', 'copy'])
    .catch('Must provide --name when using custom inline JSON sequence')
    .it('fails if using inline JSON sequence custom with no --name')

  setup
    .command(['add-assembly', '{}', '--name', 'simple', '--load', 'copy'])
    .exit(140)
    .it('fails if custom sequence adapter has no type')

  setup
    .command([
      'add-assembly',
      '{"type":"fromConfigSequenceAdapter"}',
      '--name',
      'simple',
      '--refNameAliases',
      '{}',
      '--refNameAliasesType',
      'custom',
      '--load',
      'copy',
    ])
    .exit(150)
    .it('fails if custom refNameAliases adapter has no type')

  setup
    .do(async ctx => {
      const simple2bit = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.2bit',
      )
      await copyFile(simple2bit, path.join(ctx.dir, path.basename(simple2bit)))
    })
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .exit(160)
    .it('fails if trying to add an assembly with a name that already exists')

  setup
    .command(['add-assembly', 'simple.unusual.extension.xyz', '--load', 'copy'])
    .exit(170)
    .it('fails if it cannot guess the sequence type')

  setup
    .command(['add-assembly', 'simple.doesNotExist.fasta', '--load', 'copy'])
    .catch(/Could not resolve/)
    .it('fails if it cannot find a file')

  setup
    .command([
      'add-assembly',
      '{"type":"fromConfigSequenceAdapter"}',
      '--name',
      'simple',
      '--refNameAliases',
      'notValidJSON',
      '--refNameAliasesType',
      'custom',
      '--load',
      'copy',
    ])
    .exit(40)
    .it('fails if using invalid inline JSON')
  setup
    .command([
      'add-assembly',
      'https://mysite.com/data/simple.2bit',
      '--load',
      'copy',
    ])
    .exit(120)
    .it('fails if load flag is passed with a URL')

  setup
    .do(ctx => {
      fs.copyFileSync(dataDir('simple.fasta'), ctxDir(ctx, 'simple.fasta'))
      fs.copyFileSync(
        dataDir('simple.fasta.fai'),
        ctxDir(ctx, 'simple.fasta.fai'),
      )
    })
    .command(['add-assembly', 'simple.fasta', '--load', 'copy'])
    .it('adds an assembly from a FASTA', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                faiLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.fasta.fai',
                },
                fastaLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.fasta',
                },
                type: 'IndexedFastaAdapter',
              },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      fs.copyFileSync(dataDir('simple.fasta'), ctxDir(ctx, 'simple.fa'))
      fs.copyFileSync(dataDir('simple.fasta.fai'), ctxDir(ctx, 'simple.fa.fai'))
    })
    .command(['add-assembly', 'simple.fa', '--load', 'copy'])
    .it('adds an assembly from a FASTA (.fa extension)', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                faiLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.fa.fai',
                },
                fastaLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.fa',
                },
                type: 'IndexedFastaAdapter',
              },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      fs.copyFileSync(
        dataDir('simple.fasta.gz'),
        ctxDir(ctx, 'simple.fasta.gz'),
      )
      fs.copyFileSync(
        dataDir('simple.fasta.gz.fai'),
        ctxDir(ctx, 'simple.fasta.gz.fai'),
      )
      fs.copyFileSync(
        dataDir('simple.fasta.gz.gzi'),
        ctxDir(ctx, 'simple.fasta.gz.gzi'),
      )
    })
    .command(['add-assembly', 'simple.fasta.gz', '--load', 'copy'])
    .it('adds an assembly from a compressed FASTA', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                faiLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.fasta.gz.fai',
                },
                fastaLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.fasta.gz',
                },
                gziLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.fasta.gz.gzi',
                },
                type: 'BgzipFastaAdapter',
              },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      await copyFile(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit'))
    })
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .it('adds an assembly from a 2bit', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                twoBitLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.2bit',
                },
                type: 'TwoBitAdapter',
              },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      await copyFile(
        dataDir('simple.chrom.sizes'),
        ctxDir(ctx, 'simple.chrom.sizes'),
      )
    })
    .command(['add-assembly', 'simple.chrom.sizes', '--load', 'copy'])
    .it('adds an assembly from a chrom.sizes', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                chromSizesLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.chrom.sizes',
                },
                type: 'ChromSizesAdapter',
              },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      await copyFile(dataDir('simple.json'), ctxDir(ctx, 'simple.json'))
    })
    .command(['add-assembly', 'simple.json', '--load', 'copy'])
    .it('adds an assembly from a custom adapter JSON file', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                features: [
                  {
                    end: 233,
                    refName: 'SEQUENCE_1',
                    seq: 'CCAAGATCTAAGATGTCAACACCTATCTGCTCAAGGTGGTTTTTATAAGGAGTCGCATCGAGGTAAGACATTTTAGAAGTATTTCTCAAGCGTGGGGCAGTTCGCCAAGTTACATCGCTCAGCCCAGGTTCCCTGATTCGAGAACATATCGGTGCTGGGTATTTGTTGGGTTGGTTGATTTGCACCGTAGTTTACACCTTACGACACTACCTATCCAAACAATTGTGTGATAG',
                    start: 0,
                    uniqueId: 'firstId',
                  },
                  {
                    end: 120,
                    refName: 'SEQUENCE_2',
                    seq: 'CCGAACCACAGGCCTATGTTACCATTGGAAAGCTCACCTTCCCGAAGGATTGGGACTCCACTAGTCGAAGCCTCAATTCGCCGCGATTAGATAGGGGGCAAGTGGAGATTGATGTTTGGT',
                    start: 0,
                    uniqueId: 'secondId',
                  },
                ],
                type: 'FromConfigSequenceAdapter',
              },
            },
          },
        ],
      })
    })

  setup
    .command([
      'add-assembly',
      '{"type":"FromConfigRegionsAdapter","features":[{"refName":"SEQUENCE_1","uniqueId":"firstId","start":0,"end":233},{"refName":"SEQUENCE_2","uniqueId":"secondId","start":0,"end":120}]}',
      '--name',
      'simple',
      '--load',
      'copy',
    ])
    .it('adds an assembly from a custom adapter inline JSON', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                features: [
                  {
                    end: 233,
                    refName: 'SEQUENCE_1',
                    start: 0,
                    uniqueId: 'firstId',
                  },
                  {
                    end: 120,
                    refName: 'SEQUENCE_2',
                    start: 0,
                    uniqueId: 'secondId',
                  },
                ],
                type: 'FromConfigRegionsAdapter',
              },
            },
          },
        ],
      })
    })

  setup
    .do(ctx => {
      fs.copyFileSync(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit.xyz'))
    })
    .command([
      'add-assembly',
      'simple.2bit.xyz',
      '--type',
      'twoBit',
      '--load',
      'copy',
    ])
    .it(
      "can specify --type when the type can't be inferred from the extension",
      async ctx => {
        expect(readConf(ctx)).toEqual({
          ...defaultConfig,
          assemblies: [
            {
              ...baseAssembly,
              name: 'simple.2bit.xyz',
              sequence: {
                ...baseSequence,
                adapter: {
                  twoBitLocation: {
                    locationType: 'UriLocation',
                    uri: 'simple.2bit.xyz',
                  },
                  type: 'TwoBitAdapter',
                },
                trackId: 'simple.2bit.xyz-ReferenceSequenceTrack',
              },
            },
          ],
        })
      },
    )

  setup
    .do(async ctx => {
      await copyFile(dataDir('simple.fasta.gz'), ctxDir(ctx, 'simple.fasta.gz'))
      await copyFile(
        dataDir('simple.fasta.gz.fai'),
        ctxDir(ctx, 'simple.fasta.gz.fai.abc'),
      )
      await copyFile(
        dataDir('simple.fasta.gz.gzi'),
        ctxDir(ctx, 'simple.fasta.gz.gzi.def'),
      )
    })
    .command([
      'add-assembly',
      'simple.fasta.gz',
      '--faiLocation',
      'simple.fasta.gz.fai.abc',
      '--gziLocation',
      'simple.fasta.gz.gzi.def',
      '--load',
      'copy',
    ])
    .it('can specify a custom faiLocation and gziLocation', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                faiLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.fasta.gz.fai.abc',
                },
                fastaLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.fasta.gz',
                },
                gziLocation: {
                  locationType: 'UriLocation',
                  uri: 'simple.fasta.gz.gzi.def',
                },
                type: 'BgzipFastaAdapter',
              },
            },
          },
        ],
      })
    })

  setup
    .only()
    .command([
      'add-assembly',
      '{"type":"CustomAdapter"}',
      '--name',
      'customName',
      '--alias',
      'customAlias',
      '--load',
      'copy',
    ])
    .it('can specify a custom name and alias', async ctx => {
      expect(ctx.stdout).toContain(
        'Added assembly "customName" to config.json\n',
      )
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            aliases: ['customAlias'],
            name: 'customName',
            sequence: {
              ...baseSequence,
              adapter: { type: 'CustomAdapter' },
              trackId: 'customName-ReferenceSequenceTrack',
            },
          },
        ],
      })
    })

  setup
    .command([
      'add-assembly',
      '{"type":"CustomAdapter"}',
      '--name',
      'simple',
      '--alias',
      'firstAlias',
      '--alias',
      'secondAlias',
      '--load',
      'copy',
    ])
    .it('can specify a multiple aliases', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            aliases: ['firstAlias', 'secondAlias'],
            sequence: {
              ...baseSequence,
              adapter: { type: 'CustomAdapter' },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      await copyFile(dataDir('simple.aliases'), ctxDir(ctx, 'simple.aliases'))
    })
    .command([
      'add-assembly',
      '{"type":"CustomAdapter"}',
      '--name',
      'simple',
      '--refNameAliases',
      'simple.aliases',
      '--load',
      'copy',
    ])
    .it('can specify a refNameAliases file', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            refNameAliases: {
              adapter: {
                location: {
                  locationType: 'UriLocation',
                  uri: 'simple.aliases',
                },
                type: 'RefNameAliasAdapter',
              },
            },
            sequence: {
              ...baseSequence,
              adapter: { type: 'CustomAdapter' },
            },
          },
        ],
      })
    })

  setup
    .do(ctx =>
      copyFile(dataDir('simple.aliases'), ctxDir(ctx, 'simple.aliases')),
    )
    .command([
      'add-assembly',
      '{"type":"CustomAdapter"}',
      '--name',
      'simple',
      '--refNameAliases',
      '{"type": "CustomAdapter"}',
      '--refNameAliasesType',
      'custom',
      '--load',
      'copy',
    ])
    .it('can specify a custom refNameAliases adapter', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            refNameAliases: {
              adapter: { type: 'CustomAdapter' },
            },
            sequence: {
              ...baseSequence,
              adapter: { type: 'CustomAdapter' },
            },
          },
        ],
      })
    })

  setup
    .command([
      'add-assembly',
      '{"type":"CustomAdapter"}',
      '--name',
      'simple',
      '--refNameColors',
      'red,orange,yellow, green, blue, purple',
      '--load',
      'copy',
    ])
    .it('can specify a custom name and and alias', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            refNameColors: [
              'red',
              'orange',
              'yellow',
              'green',
              'blue',
              'purple',
            ],
            sequence: {
              ...baseSequence,
              adapter: { type: 'CustomAdapter' },
            },
          },
        ],
      })
    })

  setup
    .do(async () => {
      await writeFile('config.json', '{}')
    })
    .command([
      'add-assembly',
      '{"type":"CustomAdapter"}',
      '--name',
      'simple',
      '--load',
      'copy',
    ])
    .it('can use an existing config file', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: { type: 'CustomAdapter' },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      await copyFile(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit'))
    })
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .command(['add-assembly', 'simple.2bit', '--overwrite', '--load', 'copy'])
    .it('can use --overwrite to replace an existing assembly', async ctx => {
      expect(readConf(ctx).assemblies.length).toBe(1)
    })

  setup
    .do(async ctx => {
      await mkdir('jbrowse')
      await rename('manifest.json', path.join('jbrowse', 'manifest.json'))
      await copyFile(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit'))
      process.chdir('jbrowse')
    })
    .command([
      'add-assembly',
      path.join('..', 'simple.2bit'),
      '--load',
      'inPlace',
    ])

  setup
    .nock('https://mysite.com', site =>
      site.head('/data/simple.2bit').reply(200),
    )
    .command(['add-assembly', 'https://mysite.com/data/simple.2bit'])
    .it('adds an assembly from a URL', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                twoBitLocation: {
                  locationType: 'UriLocation',
                  uri: 'https://mysite.com/data/simple.2bit',
                },
                type: 'TwoBitAdapter',
              },
            },
          },
        ],
      })
    })

  setup
    .do(ctx =>
      fs.copyFileSync(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit')),
    )
    .command([
      'add-assembly',
      'simple.2bit',
      '--load',
      'copy',
      '--out',
      'testing',
    ])
    .it('can use --out to make a new directory', async ctx => {
      expect(readConf(ctx, 'testing').assemblies.length).toBe(1)
    })

  setup
    .do(ctx => {
      fs.copyFileSync(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit'))
    })
    .command([
      'add-assembly',
      'simple.2bit',
      '--load',
      'copy',
      '--out',
      'out/testing.json',
    ])
    .it('can use --out to write to a file', async ctx => {
      expect(readConfAlt(ctx, 'out', 'testing.json').assemblies.length).toBe(1)
    })
})
