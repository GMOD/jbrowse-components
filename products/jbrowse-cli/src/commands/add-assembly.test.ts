/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'

import { setup } from '../testUtil'

const fsPromises = fs.promises

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
    .exit(130)
    .it('fails if using inline JSON sequence custom with no --name')

  setup
    .command(['add-assembly', '{}', '--name', 'simple', '--load', 'copy'])
    .exit(140)
    .it('fails if custom sequence adapter has no type')

  setup
    .command([
      'add-assembly',
      '{"type":"fromConfigAdapter"}',
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
      await fsPromises.copyFile(
        simple2bit,
        path.join(ctx.dir, path.basename(simple2bit)),
      )
    })
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .exit(160)
    .it('fails if trying to add an assembly with a name that already exists')

  setup
    .do(async () => {
      await fsPromises.unlink('manifest.json')
    })
    .command(['add-assembly', 'simple.fasta'])
    .exit(10)
    .it('fails if no manifest.json found in cwd')

  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', 'This Is Invalid JSON')
    })
    .command(['add-assembly', 'simple.fasta'])
    .exit(20)
    .it("fails if it can't parse manifest.json")

  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', '{"name":"NotJBrowse"}')
    })
    .command(['add-assembly', 'simple.fasta'])
    .exit(30)
    .it('fails if "name" in manifest.json is not "JBrowse"')

  setup
    .command(['add-assembly', 'simple.unusual.extension.xyz', '--load', 'copy'])
    .exit(170)
    .it('fails if it cannot guess the sequence type')

  setup
    .command(['add-assembly', 'simple.doesNotExist.fasta', '--load', 'copy'])
    .exit(40)
    .it('fails if it cannot find a file')

  setup
    .command([
      'add-assembly',
      '{"type":"fromConfigAdapter"}',
      '--name',
      'simple',
      '--refNameAliases',
      'notValidJSON',
      '--refNameAliasesType',
      'custom',
      '--load',
      'copy',
    ])
    .exit(50)
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
    .do(async ctx => {
      const simpleFasta = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.fasta',
      )
      await fsPromises.copyFile(
        simpleFasta,
        path.join(ctx.dir, path.basename(simpleFasta)),
      )
      await fsPromises.copyFile(
        `${simpleFasta}.fai`,
        path.join(ctx.dir, path.basename(`${simpleFasta}.fai`)),
      )
    })
    .command(['add-assembly', 'simple.fasta', '--load', 'copy'])
    .it('adds an assembly from a FASTA', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'IndexedFastaAdapter',
                fastaLocation: { uri: 'simple.fasta' },
                faiLocation: { uri: 'simple.fasta.fai' },
              },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      const simpleFasta = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.fasta',
      )
      const simpleFastaFaExtensionBasename = `${path.basename(
        simpleFasta,
        '.fasta',
      )}.fa`
      await fsPromises.copyFile(
        simpleFasta,
        path.join(ctx.dir, simpleFastaFaExtensionBasename),
      )
      await fsPromises.copyFile(
        `${simpleFasta}.fai`,
        path.join(ctx.dir, `${simpleFastaFaExtensionBasename}.fai`),
      )
    })
    .command(['add-assembly', 'simple.fa', '--load', 'copy'])
    .it('adds an assembly from a FASTA (.fa extension)', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'IndexedFastaAdapter',
                fastaLocation: { uri: 'simple.fa' },
                faiLocation: { uri: 'simple.fa.fai' },
              },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      const simpleCompressedFasta = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.fasta.gz',
      )
      await fsPromises.copyFile(
        simpleCompressedFasta,
        path.join(ctx.dir, path.basename(simpleCompressedFasta)),
      )
      await fsPromises.copyFile(
        `${simpleCompressedFasta}.fai`,
        path.join(ctx.dir, path.basename(`${simpleCompressedFasta}.fai`)),
      )
      await fsPromises.copyFile(
        `${simpleCompressedFasta}.gzi`,
        path.join(ctx.dir, path.basename(`${simpleCompressedFasta}.gzi`)),
      )
    })
    .command(['add-assembly', 'simple.fasta.gz', '--load', 'copy'])
    .it('adds an assembly from a compressed FASTA', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'BgzipFastaAdapter',
                fastaLocation: { uri: 'simple.fasta.gz' },
                faiLocation: { uri: 'simple.fasta.gz.fai' },
                gziLocation: { uri: 'simple.fasta.gz.gzi' },
              },
            },
          },
        ],
      })
    })

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
      await fsPromises.copyFile(
        simple2bit,
        path.join(ctx.dir, path.basename(simple2bit)),
      )
    })
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .it('adds an assembly from a 2bit', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'TwoBitAdapter',
                twoBitLocation: { uri: 'simple.2bit' },
              },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      const simpleChromSizes = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.chrom.sizes',
      )
      await fsPromises.copyFile(
        simpleChromSizes,
        path.join(ctx.dir, path.basename(simpleChromSizes)),
      )
    })
    .command(['add-assembly', 'simple.chrom.sizes', '--load', 'copy'])
    .it('adds an assembly from a chrom.sizes', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'ChromSizesAdapter',
                chromSizesLocation: { uri: 'simple.chrom.sizes' },
              },
            },
          },
        ],
      })
    })

  setup
    .do(async ctx => {
      const simpleFromConfig = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.json',
      )
      await fsPromises.copyFile(
        simpleFromConfig,
        path.join(ctx.dir, path.basename(simpleFromConfig)),
      )
    })
    .command(['add-assembly', 'simple.json', '--load', 'copy'])
    .it('adds an assembly from a custom adapter JSON file', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'FromConfigAdapter',
                features: [
                  {
                    refName: 'SEQUENCE_1',
                    uniqueId: 'firstId',
                    start: 0,
                    end: 233,
                    seq:
                      'CCAAGATCTAAGATGTCAACACCTATCTGCTCAAGGTGGTTTTTATAAGGAGTCGCATCGAGGTAAGACATTTTAGAAGTATTTCTCAAGCGTGGGGCAGTTCGCCAAGTTACATCGCTCAGCCCAGGTTCCCTGATTCGAGAACATATCGGTGCTGGGTATTTGTTGGGTTGGTTGATTTGCACCGTAGTTTACACCTTACGACACTACCTATCCAAACAATTGTGTGATAG',
                  },
                  {
                    refName: 'SEQUENCE_2',
                    uniqueId: 'secondId',
                    start: 0,
                    end: 120,
                    seq:
                      'CCGAACCACAGGCCTATGTTACCATTGGAAAGCTCACCTTCCCGAAGGATTGGGACTCCACTAGTCGAAGCCTCAATTCGCCGCGATTAGATAGGGGGCAAGTGGAGATTGATGTTTGGT',
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
      '{"type":"FromConfigAdapter","features":[{"refName":"SEQUENCE_1","uniqueId":"firstId","start":0,"end":233},{"refName":"SEQUENCE_2","uniqueId":"secondId","start":0,"end":120}]}',
      '--name',
      'simple',
      '--load',
      'copy',
    ])
    .it('adds an assembly from a custom adapter inline JSON', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'FromConfigAdapter',
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
    .do(async ctx => {
      const simple2bit = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.2bit',
      )
      await fsPromises.copyFile(
        simple2bit,
        path.join(ctx.dir, `${path.basename(simple2bit)}.xyz`),
      )
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
        expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
        const contents = await fsPromises.readFile(
          path.join(ctx.dir, 'config.json'),
          { encoding: 'utf8' },
        )
        expect(JSON.parse(contents)).toEqual({
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
                  twoBitLocation: { uri: 'simple.2bit.xyz' },
                },
              },
            },
          ],
        })
      },
    )

  setup
    .do(async ctx => {
      const simpleCompressedFasta = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.fasta.gz',
      )
      await fsPromises.copyFile(
        simpleCompressedFasta,
        path.join(ctx.dir, path.basename(simpleCompressedFasta)),
      )
      await fsPromises.copyFile(
        `${simpleCompressedFasta}.fai`,
        path.join(ctx.dir, path.basename(`${simpleCompressedFasta}.fai.abc`)),
      )
      await fsPromises.copyFile(
        `${simpleCompressedFasta}.gzi`,
        path.join(ctx.dir, path.basename(`${simpleCompressedFasta}.gzi.def`)),
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
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'BgzipFastaAdapter',
                fastaLocation: { uri: 'simple.fasta.gz' },
                faiLocation: { uri: 'simple.fasta.gz.fai.abc' },
                gziLocation: { uri: 'simple.fasta.gz.gzi.def' },
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
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(ctx.stdoutWrite).toHaveBeenCalledWith(
        'Added assembly "customName" to ./config.json\n',
      )
      expect(JSON.parse(contents)).toEqual({
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
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
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
      const refNameAliasesFile = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.aliases',
      )
      await fsPromises.copyFile(
        refNameAliasesFile,
        path.join(ctx.dir, path.basename(refNameAliasesFile)),
      )
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
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            refNameAliases: {
              adapter: {
                location: { uri: 'simple.aliases' },
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
      const refNameAliasesFile = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.aliases',
      )
      await fsPromises.copyFile(
        refNameAliasesFile,
        path.join(ctx.dir, path.basename(refNameAliasesFile)),
      )
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
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
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
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
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
      await fsPromises.writeFile('config.json', '{}')
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
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
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
      const simple2bit = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.2bit',
      )
      await fsPromises.copyFile(
        simple2bit,
        path.join(ctx.dir, path.basename(simple2bit)),
      )
    })
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .command(['add-assembly', 'simple.2bit', '--overwrite', '--load', 'copy'])
    .it('can use --overwrite to replace an existing assembly', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents).assemblies.length).toBe(1)
    })

  setup
    .do(async ctx => {
      await fsPromises.mkdir('jbrowse')
      await fsPromises.rename(
        'manifest.json',
        path.join('jbrowse', 'manifest.json'),
      )
      const simple2bit = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'simple.2bit',
      )
      await fsPromises.copyFile(
        simple2bit,
        path.join(ctx.dir, path.basename(simple2bit)),
      )
      process.chdir('jbrowse')
    })
    .mockConsoleLog()
    .mockConsoleError()
    .command([
      'add-assembly',
      path.join('..', 'simple.2bit'),
      '--load',
      'trust',
    ])

  setup
    .nock('https://mysite.com', site =>
      site.head('/data/simple.2bit').reply(200),
    )
    .command(['add-assembly', 'https://mysite.com/data/simple.2bit'])
    .it('adds an assembly from a URL', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('config.json')
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        assemblies: [
          {
            ...baseAssembly,
            sequence: {
              ...baseSequence,
              adapter: {
                type: 'TwoBitAdapter',
                twoBitLocation: { uri: 'https://mysite.com/data/simple.2bit' },
              },
            },
          },
        ],
      })
    })
})
