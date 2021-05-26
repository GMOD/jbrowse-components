/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'

import { setup } from '../testUtil'

const fsPromises = fs.promises

const baseDir = path.join(__dirname, '..', '..', 'test', 'data')
const simpleBam = path.join(baseDir, 'simple.bam')
const simpleBai = path.join(baseDir, 'simple.bai')
const testConfig = path.join(baseDir, 'test_config.json')

async function initctx(ctx: { dir: string }) {
  await fsPromises.copyFile(testConfig, path.join(ctx.dir, 'config.json'))
}
async function init2bit(ctx: { dir: string }) {
  await fsPromises.copyFile(
    path.join(baseDir, 'simple.2bit'),
    path.join(ctx.dir, 'simple.2bit'),
  )
}

async function readConf(ctx: { dir: string }) {
  return fsPromises.readFile(path.join(ctx.dir, 'config.json'), {
    encoding: 'utf8',
  })
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
    .it('cannot add a track with the same track id')

  setup
    .do(initctx)
    .command(['add-track', simpleBam, '--load', 'symlink'])
    .command(['add-track', simpleBam, '--load', 'symlink', '--force'])
    .it('use force to overwrite a symlink')

  setup
    .do(initctx)
    .command(['add-track', simpleBam, '--load', 'copy'])
    .command(['add-track', simpleBam, '--load', 'copy', '--force'])
    .it('use force to overwrite a copied file')

  // setting up a test for move difficult currently, because it would literally
  // move the file in our test data...
  // setup
  //   .do(initctx)
  //   .do(async ctx => {
  //     await fsPromises.copyFile(simpleBam, path.join(ctx.dir, 'new.bam'))
  //     await fsPromises.copyFile(simpleBai, path.join(ctx.dir, 'new.bam.bai'))
  //   })
  //   .command(['add-track', 'new.bam', '--load', 'move'])
  //   .command(['add-track', 'new.bam', '--load', 'move', '--force'])
  //   .it('use force to overwrite a moved file')

  setup
    .command(['add-track', simpleBam, '--load', 'copy'])
    .catch(/no such file or directory/)
    .it('cannot add a track if there is no config file')
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
      const contents = await readConf(ctx)
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
      const contents = await readConf(ctx)

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
      const contents = await readConf(ctx)

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
      const contents = await readConf(ctx)
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
      const contents = await readConf(ctx)
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
      const contents = await readConf(ctx)
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
      const contents = await readConf(ctx)
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
      const contents = await readConf(ctx)
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
      const contents = await readConf(ctx)
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
