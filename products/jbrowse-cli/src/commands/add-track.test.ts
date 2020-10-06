/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'

import { setup } from '../testUtil'

const fsPromises = fs.promises

const simpleBam = path.join(__dirname, '..', '..', 'test', 'data', 'simple.bam')
const testConfig = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'test_config.json',
)

describe('add-track', () => {
  setup
    .command(['add-track', '{}'])
    .exit(180)
    .it('fails if no data directory is specified')
  setup
    .command(['add-track', simpleBam])
    .exit(110)
    .it('fails if load flag isnt passed')
  setup
    .nock('https://mysite.com', site =>
      site.head('/data/simple.bam').reply(200),
    )
    .command([
      'add-track',
      'https://mysite.com/data/simple.bam',
      '--load',
      'inPlace',
    ])
    .exit(100)
    .it('fails if URL with load flag is passed')
  setup
    .do(async () => {
      await fsPromises.unlink('manifest.json')
    })
    .command(['add-track', simpleBam])
    .exit(10)
    .it('fails if no manifest.json found in cwd')
  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', 'This Is Invalid JSON')
    })
    .command(['add-track', simpleBam])
    .exit(20)
    .it("fails if it can't parse manifest.json")

  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', '{"name":"NotJBrowse"}')
    })
    .command(['add-track', simpleBam])
    .exit(30)
    .it('fails if "name" in manifest.json is not "JBrowse"')
  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['add-track', simpleBam, '--load', 'copy'])
    .command(['add-track', simpleBam, '--load', 'copy'])
    .exit(160)
    .it('Cannot add a track with the same track id')
  setup
    .command(['add-track', simpleBam, '--load', 'copy'])
    .catch(/no such file or directory/)
    .it('Cannot add a track if there is no config file')
  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
      await fsPromises.writeFile(
        path.join(ctx.dir, 'config.json'),
        '{"assemblies":[]}',
      )
    })
    .command(['add-track', simpleBam, '--load', 'copy'])
    .exit(150)
    .it('fails if it cannot assume the assemblyname')

  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['add-track', simpleBam, '--load', 'copy'])
    .it('adds a track', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'simple',
          name: 'simple',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'simple.bam',
            },
            index: {
              location: {
                uri: 'simple.bam.bai',
              },
            },
            sequenceAdapter: {
              type: 'testSeqAdapter',
              twoBitLocation: {
                uri: 'test.2bit',
              },
            },
          },
        },
      ])
    })
  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--name',
      'customName',
      '--trackId',
      'customTrackId',
      '--description',
      'new description',
      '--type',
      'CustomTrackType',
      '--category',
      'newcategory',
      '--assemblyNames',
      'customAssemblyName',
      '--config',
      '{"defaultRendering": "test"}',
    ])
    .it('adds a track with all the custom fields', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'CustomTrackType',
          trackId: 'customTrackId',
          name: 'customName',
          description: 'new description',
          category: ['newcategory'],
          assemblyNames: ['customAssemblyName'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'simple.bam',
            },
            index: {
              location: {
                uri: 'simple.bam.bai',
              },
            },
          },
          defaultRendering: 'test',
        },
      ])
    })

  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .nock('https://mysite.com', site =>
      site.head('/data/simple.bam').replyWithFile(200, simpleBam),
    )
    .command(['add-track', 'https://mysite.com/data/simple.bam'])
    .it('adds a track from a url', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'simple',
          name: 'simple',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://mysite.com/data/simple.bam',
            },
            index: {
              location: {
                uri: 'https://mysite.com/data/simple.bam.bai',
              },
            },
            sequenceAdapter: {
              type: 'testSeqAdapter',
              twoBitLocation: {
                uri: 'test.2bit',
              },
            },
          },
        },
      ])
    })

  // fails when there is more than one assembly and none is specified on the
  // command line
  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
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
    })
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .command(['add-track', simpleBam, '--load', 'copy'])
    .exit(2)
    .it('fails multiple assemblies exist but no assemblyNames passed')

  // fails when there is more than one assembly and none is specified on the
  // command line
  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
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
    })
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .command([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--assemblyNames',
      'testAssembly',
    ])
    .it('adds a track to a config with multiple assemblies', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'simple',
          name: 'simple',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'simple.bam',
            },
            index: {
              location: {
                uri: 'simple.bam.bai',
              },
            },

            sequenceAdapter: {
              twoBitLocation: {
                uri: 'test.2bit',
              },
              type: 'testSeqAdapter',
            },
          },
        },
      ])
    })
})
