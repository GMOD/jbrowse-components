/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'

import { setup } from '../testUtil'

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

const testPath = path.join(__dirname, '..', '..', 'test', 'data')

function readJSON(path: string) {
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}

function readConf(ctx: any) {
  return readJSON(path.join(ctx.dir, 'config.json'))
}

async function copyTmp(src: string, ctx: any, destname?: string) {
  console.log(
    't1',
    ctx.dir,
    path.join(testPath, src),
    path.join(ctx.dir, destname || path.basename(src)),
  )
  await copyFile(
    path.join(testPath, src),
    path.join(ctx.dir, destname || path.basename(src)),
  )
}

const baseAssembly = { name: 'simple', sequence: {} }
const baseSequence = {
  type: 'ReferenceSequenceTrack',
  trackId: 'simple-ReferenceSequenceTrack',
  adapter: {},
}

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
    .command([
      'add-assembly',
      path.join(testPath, 'simple.2bit'),
      '--load',
      'copy',
    ])
    .command([
      'add-assembly',
      path.join(testPath, 'simple.2bit'),
      '--load',
      'copy',
    ])
    .catch(/file already exists/)
    .it('fails if trying to add an assembly with same file')

  setup
    .command([
      'add-assembly',
      path.join(testPath, 'simple.2bit'),
      '--load',
      'copy',
    ])
    .command([
      'add-assembly',
      path.join(testPath, 'simple.fasta'),
      '--load',
      'copy',
    ])
    .exit(160)
    .it('fails if trying to add an assembly with a name that already exists')

  setup
    .command([
      'add-assembly',
      'simple.unusual.extension.xyz',
      '--load',
      'copy',
      '--force',
    ])
    .exit(170)
    .it('fails if it cannot guess the sequence type')

  setup
    .command(['add-assembly', 'simple.doesNotExist.fasta', '--load', 'copy'])
    .catch(/no such file or directory/)
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
    .command([
      'add-assembly',
      path.join(testPath, 'simple.fasta'),
      '--load',
      'copy',
      '--force',
    ])
    .it('adds an assembly from a FASTA', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'IndexedFastaAdapter',
                fastaLocation: {
                  uri: 'simple.fasta',
                },
                faiLocation: {
                  uri: 'simple.fasta.fai',
                },
              },
            },
          },
        ],
      })
    })

  setup
    .command([
      'add-assembly',
      path.join(testPath, 'simple.fa'),
      '--load',
      'copy',
      '--force',
    ])
    .it('adds an assembly from a FASTA (.fa extension)', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'IndexedFastaAdapter',
                fastaLocation: {
                  uri: 'simple.fa',
                },
                faiLocation: {
                  uri: 'simple.fa.fai',
                },
              },
            },
          },
        ],
      })
    })

  setup
    .command([
      'add-assembly',
      path.join(testPath, 'simple.fasta.gz'),
      '--load',
      'copy',
    ])
    .it('adds an assembly from a compressed FASTA', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'BgzipFastaAdapter',
                fastaLocation: {
                  uri: 'simple.fasta.gz',
                },
                faiLocation: {
                  uri: 'simple.fasta.gz.fai',
                },
                gziLocation: {
                  uri: 'simple.fasta.gz.gzi',
                },
              },
            },
          },
        ],
      })
    })

  setup
    .command([
      'add-assembly',
      path.join(testPath, 'simple.2bit'),
      '--load',
      'copy',
    ])
    .it('adds an assembly from a 2bit', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'TwoBitAdapter',
                twoBitLocation: {
                  uri: 'simple.2bit',
                },
              },
            },
          },
        ],
      })
    })

  setup
    .command([
      'add-assembly',
      path.join(testPath, 'simple.chrom.sizes'),
      '--load',
      'copy',
    ])
    .it('adds an assembly from a chrom.sizes', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'ChromSizesAdapter',
                chromSizesLocation: {
                  uri: 'simple.chrom.sizes',
                },
              },
            },
          },
        ],
      })
    })

  setup
    .command([
      'add-assembly',
      path.join(testPath, 'simple.json'),
      '--load',
      'copy',
    ])
    .it('adds an assembly from a custom adapter JSON file', async ctx => {
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'FromConfigSequenceAdapter',
                features: [
                  {
                    refName: 'SEQUENCE_1',
                    uniqueId: 'firstId',
                    start: 0,
                    end: 233,
                    seq: 'CCAAGATCTAAGATGTCAACACCTATCTGCTCAAGGTGGTTTTTATAAGGAGTCGCATCGAGGTAAGACATTTTAGAAGTATTTCTCAAGCGTGGGGCAGTTCGCCAAGTTACATCGCTCAGCCCAGGTTCCCTGATTCGAGAACATATCGGTGCTGGGTATTTGTTGGGTTGGTTGATTTGCACCGTAGTTTACACCTTACGACACTACCTATCCAAACAATTGTGTGATAG',
                  },
                  {
                    refName: 'SEQUENCE_2',
                    uniqueId: 'secondId',
                    start: 0,
                    end: 120,
                    seq: 'CCGAACCACAGGCCTATGTTACCATTGGAAAGCTCACCTTCCCGAAGGATTGGGACTCCACTAGTCGAAGCCTCAATTCGCCGCGATTAGATAGGGGGCAAGTGGAGATTGATGTTTGGT',
                  },
                ],
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
                type: 'FromConfigRegionsAdapter',
                features: [
                  {
                    refName: 'SEQUENCE_1',
                    uniqueId: 'firstId',
                    start: 0,
                    end: 233,
                  },
                  {
                    refName: 'SEQUENCE_2',
                    uniqueId: 'secondId',
                    start: 0,
                    end: 120,
                  },
                ],
              },
            },
          },
        ],
      })
    })

  setup
    .command([
      'add-assembly',
      path.join(testPath, 'simple.2bit.xyz'),
      '--type',
      'twoBit',
      '--load',
      'copy',
      '--force',
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
                trackId: 'simple.2bit.xyz-ReferenceSequenceTrack',
                adapter: {
                  type: 'TwoBitAdapter',
                  twoBitLocation: {
                    uri: 'simple.2bit.xyz',
                  },
                },
              },
            },
          ],
        })
      },
    )

  setup

    .command([
      'add-assembly',
      path.join(testPath, 'simple.fasta.gz'),
      '--faiLocation',
      path.join(testPath, 'simple.fasta.gz.fai.abc'),
      '--gziLocation',
      path.join(testPath, 'simple.fasta.gz.gzi.def'),
      '--load',
      'copy',
      '--force',
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
                type: 'BgzipFastaAdapter',
                fastaLocation: {
                  uri: 'simple.fasta.gz',
                },
                faiLocation: {
                  uri: 'simple.fasta.gz.fai.abc',
                },
                gziLocation: {
                  uri: 'simple.fasta.gz.gzi.def',
                },
              },
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
      'customName',
      '--alias',
      'customAlias',
      '--load',
      'copy',
    ])
    .it('can specify a custom name and and alias', async ctx => {
      expect(ctx.stdoutWrite).toHaveBeenCalledWith(
        'Added assembly "customName" to ./config.json\n',
      )
      expect(readConf(ctx)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            name: 'customName',
            aliases: ['customAlias'],
            sequence: {
              ...baseSequence,
              trackId: 'customName-ReferenceSequenceTrack',
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
      copyTmp('simple.aliases', ctx)
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
    .do(async ctx => {
      copyTmp('simple.aliases', ctx)
    })
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
    .command([
      'add-assembly',
      path.join(testPath, 'simple.2bit'),
      '--load',
      'copy',
      '--force',
    ])
    .command([
      'add-assembly',
      path.join(testPath, 'simple.2bit'),
      '--overwrite',
      '--load',
      'copy',
      '--force',
    ])
    .it('can use --overwrite to replace an existing assembly', async ctx => {
      expect(readConf(ctx).assemblies.length).toBe(1)
    })

  setup
    .do(async ctx => {
      await mkdir('jbrowse')
      await rename('manifest.json', path.join('jbrowse', 'manifest.json'))
      copyTmp('simple.2bit', ctx)
      process.chdir('jbrowse')
    })
    .command([
      'add-assembly',
      path.join('..', 'simple.2bit'),
      '--load',
      'inPlace',
    ])

  setup
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
                type: 'TwoBitAdapter',
                twoBitLocation: {
                  uri: 'https://mysite.com/data/simple.2bit',
                },
              },
            },
          },
        ],
      })
    })

  setup
    .command([
      'add-assembly',
      path.join(testPath, 'simple.2bit'),
      '--load',
      'copy',
      '--out',
      'testing',
    ])
    .it('can use --out to make a new directory', async ctx => {
      const conf = readJSON(path.join(ctx.dir, 'testing', 'config.json'))
      expect(conf.assemblies.length).toBe(1)
    })
})
