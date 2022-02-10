/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'

import { setup } from '../testUtil'

const { writeFile, readFile, copyFile } = fs.promises

const baseDir = path.join(__dirname, '..', '..', 'test', 'data')
const simpleBam = path.join(baseDir, 'simple.bam')
const simpleBai = path.join(baseDir, 'simple.bai')
const simpleGff = path.join(baseDir, 'volvox.sort.gff3')
const simpleVcf = path.join(baseDir, 'volvox.filtered.vcf')
const simpleGtf = path.join(baseDir, 'volvox.sorted.gtf')
const simpleGffGz = path.join(baseDir, 'volvox.sort.gff3.gz')
const testConfig = path.join(baseDir, 'test_config.json')

function initctx(ctx: { dir: string }) {
  return copyFile(testConfig, path.join(ctx.dir, 'config.json'))
}
function init2bit(ctx: { dir: string }) {
  return copyFile(
    path.join(baseDir, 'simple.2bit'),
    path.join(ctx.dir, 'simple.2bit'),
  )
}

async function readConf(ctx: { dir: string }) {
  return readFile(path.join(ctx.dir, 'config.json'), {
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
    .do(ctx =>
      writeFile(path.join(ctx.dir, 'config.json'), '{"assemblies":[]}'),
    )
    .command(['add-track', simpleBam, '--load', 'copy'])
    .exit(150)
    .it('fails if it cannot assume the assemblyname')

  setup
    .do(initctx)
    .command(['add-track', simpleBam, '--load', 'copy'])
    .it('adds a bam track with bai', async ctx => {
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
    .command([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--indexFile',
      simpleBam + '.csi',
    ])
    .it('adds a bam track with csi', async ctx => {
      const contents = await readConf(ctx)
      expect(fs.existsSync(path.join(ctx.dir, 'simple.bam'))).toBeTruthy()
      expect(fs.existsSync(path.join(ctx.dir, 'simple.bam.csi'))).toBeTruthy()
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
              indexType: 'CSI',
              location: {
                uri: 'simple.bam.csi',
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
    .it('adds a bam track with load inPlace', async ctx => {
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
    .it('adds a bam track with load inPlace', async ctx => {
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
    .it('adds a bam track with indexFile for bai', async ctx => {
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
    .it('adds a bam track with subDir', async ctx => {
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
    .it('adds a bam track with subDir and localPath protocol', async ctx => {
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
              locationType: 'LocalPathLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                localPath: 'bam/simple.bam.bai',
                locationType: 'LocalPathLocation',
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
    .it('adds a bam track with all the custom fields', async ctx => {
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
    .it('adds a bam track from a url', async ctx => {
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

  setup
    .do(initctx)
    .command(['add-track', simpleGff, '--load', 'copy'])
    .it('adds a plaintext gff', async ctx => {
      const contents = await readConf(ctx)
      expect(fs.existsSync(path.join(ctx.dir, 'volvox.sort.gff3'))).toBeTruthy()
      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'FeatureTrack',
          trackId: 'volvox.sort',
          name: 'volvox.sort',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'Gff3Adapter',
            gffLocation: {
              uri: 'volvox.sort.gff3',
            },
          },
        },
      ])
    })

  setup
    .do(initctx)
    .command(['add-track', simpleVcf, '--load', 'copy'])
    .it('adds a plaintext vcf', async ctx => {
      const contents = await readConf(ctx)
      expect(
        fs.existsSync(path.join(ctx.dir, 'volvox.filtered.vcf')),
      ).toBeTruthy()
      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'FeatureTrack',
          trackId: 'volvox.filtered',
          name: 'volvox.filtered',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'VcfAdapter',
            vcfLocation: {
              uri: 'volvox.filtered.vcf',
            },
          },
        },
      ])
    })

  setup
    .do(initctx)
    .command(['add-track', simpleGtf, '--load', 'copy'])
    .it('adds a plaintext gtf', async ctx => {
      const contents = await readConf(ctx)
      expect(
        fs.existsSync(path.join(ctx.dir, 'volvox.sorted.gtf')),
      ).toBeTruthy()
      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'FeatureTrack',
          trackId: 'volvox.sorted',
          name: 'volvox.sorted',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'GtfAdapter',
            gtfLocation: {
              uri: 'volvox.sorted.gtf',
            },
          },
        },
      ])
    })

  setup
    .do(initctx)
    .command([
      'add-track',
      simpleGffGz,
      '--load',
      'copy',
      '--indexFile',
      simpleGffGz + '.csi',
    ])
    .it('adds a tabix gff with csi', async ctx => {
      const contents = await readConf(ctx)
      expect(
        fs.existsSync(path.join(ctx.dir, 'volvox.sort.gff3.gz')),
      ).toBeTruthy()
      expect(
        fs.existsSync(path.join(ctx.dir, 'volvox.sort.gff3.gz.csi')),
      ).toBeTruthy()
      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'FeatureTrack',
          trackId: 'volvox.sort.gff3',
          name: 'volvox.sort.gff3',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'volvox.sort.gff3.gz',
            },
            index: {
              location: {
                uri: 'volvox.sort.gff3.gz.csi',
              },
              indexType: 'CSI',
            },
          },
        },
      ])
    })

  setup
    .do(initctx)
    .command(['add-track', simpleGffGz, '--load', 'copy'])
    .it('adds a tabix gff', async ctx => {
      const contents = await readConf(ctx)
      expect(
        fs.existsSync(path.join(ctx.dir, 'volvox.sort.gff3.gz')),
      ).toBeTruthy()
      expect(
        fs.existsSync(path.join(ctx.dir, 'volvox.sort.gff3.gz.tbi')),
      ).toBeTruthy()
      expect(JSON.parse(contents).tracks).toEqual([
        {
          type: 'FeatureTrack',
          trackId: 'volvox.sort.gff3',
          name: 'volvox.sort.gff3',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'volvox.sort.gff3.gz',
            },
            index: {
              location: {
                uri: 'volvox.sort.gff3.gz.tbi',
              },
              indexType: 'TBI',
            },
          },
        },
      ])
    })
})
