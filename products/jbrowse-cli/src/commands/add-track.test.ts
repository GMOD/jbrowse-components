/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'

import { setup } from '../testUtil'

const fsPromises = fs.promises

const simpleBam = path.join(__dirname, '..', '..', 'test', 'data', 'simple.bam')
const simpleBai = path.join(__dirname, '..', '..', 'test', 'data', 'simple.bai')
const testConfig = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'test_config.json',
)

async function initctx(ctx: { dir: string }) {
  await fsPromises.copyFile(
    testConfig,
    path.join(ctx.dir, path.basename(testConfig)),
  )

  await fsPromises.rename(
    path.join(ctx.dir, path.basename(testConfig)),
    path.join(ctx.dir, 'config.json'),
  )
}
async function init2bit(ctx: { dir: string }) {
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
}

describe('add-track', () => {
  setup.command(['add-track']).exit(2).it('fails if no track is specified')
  setup
    .command(['add-track', simpleBam])
    .exit(110)
    .it('fails if load flag isnt passed in for a localFile')
  setup
    .command([
      'add-track',
      'https://mysite.com/data/simple.bam',
      '--load',
      'inPlace',
    ])
    .exit(100)
    .it('fails if URL with load flag is passed')

  setup
    .do(initctx)
    .command(['add-track', simpleBam, '--load', 'copy'])
    .command(['add-track', simpleBam, '--load', 'copy'])
    .exit(160)
    .it('Cannot add a track with the same track id')
  setup
    .command(['add-track', simpleBam, '--load', 'copy'])
    .catch(/no such file or directory/)
    .it('Cannot add a track if there is no config file')
  setup
    .do(initctx)
    .do(ctx => {
      return fsPromises.writeFile(
        path.join(ctx.dir, 'config.json'),
        '{"assemblies":[]}',
      )
    })
    .command(['add-track', simpleBam, '--load', 'copy'])
    .exit(150)
    .it('fails if it cannot assume the assemblyname')

  setup
    .do(initctx)
    .command(['add-track', simpleBam, '--load', 'copy'])
    .it('adds a track', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )

      expect(fs.existsSync(path.join(ctx.dir, 'simple.bam'))).toBeTruthy()
      expect(fs.existsSync(path.join(ctx.dir, 'simple.bam.bai'))).toBeTruthy()

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
              indexType: 'BAI',
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
    .do(initctx)
    .command(['add-track', '/testing/in/place.bam', '--load', 'inPlace'])
    .it('adds a track with load inPlace', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )

      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'place',
          name: 'place',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: '/testing/in/place.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: '/testing/in/place.bam.bai',
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
    .do(initctx)
    .command([
      'add-track',
      '/testing/in/place.bam',
      '--load',
      'inPlace',
      '--indexFile',
      '/something/else/random.bai',
    ])
    .it('adds a track with load inPlace', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )

      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'place',
          name: 'place',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: '/testing/in/place.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: '/something/else/random.bai',
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
    .do(initctx)
    .command([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--indexFile',
      simpleBai,
    ])
    .it('adds a track', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )

      expect(fs.existsSync(path.join(ctx.dir, 'simple.bam'))).toBeTruthy()
      expect(fs.existsSync(path.join(ctx.dir, 'simple.bai'))).toBeTruthy()

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
              indexType: 'BAI',
              location: {
                uri: 'simple.bai',
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
    .do(initctx)
    .command(['add-track', simpleBam, '--load', 'copy', '--subDir', 'bam'])
    .it('adds a track with subDir', async ctx => {
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
              uri: 'bam/simple.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: 'bam/simple.bam.bai',
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
    .do(initctx)
    .command([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--protocol',
      'localPath',
      '--subDir',
      'bam',
    ])
    .it('adds a track with subDir', async ctx => {
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
              localPath: 'bam/simple.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                localPath: 'bam/simple.bam.bai',
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
    .do(initctx)
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
      '--trackType',
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
              indexType: 'BAI',
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
    .do(initctx)
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
              indexType: 'BAI',
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
    .do(initctx)
    .do(init2bit)
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .command(['add-track', simpleBam, '--load', 'copy'])
    .exit(2)
    .it('fails multiple assemblies exist but no assemblyNames passed')

  // fails when there is more than one assembly and none is specified on the
  // command line
  setup
    .do(initctx)
    .do(init2bit)
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
              indexType: 'BAI',
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
