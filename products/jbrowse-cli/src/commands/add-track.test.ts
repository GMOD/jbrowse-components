/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

import { setup, readConf, ctxDir } from '../testUtil'

const { writeFile, copyFile } = fs.promises

const exists = (p: string) => fs.existsSync(p)

const base = path.join(__dirname, '..', '..', 'test', 'data')
const simpleBam = path.join(base, 'simple.bam')
const simpleBai = path.join(base, 'simple.bai')
const simpleGff = path.join(base, 'volvox.sort.gff3')
const simpleBed = path.join(base, 'volvox.bed')
const simpleBedpe = path.join(base, 'volvox.bedpe')
const simplePaf = path.join(base, 'volvox_inv_indels.paf')
const simplePafGz = path.join(base, 'volvox_inv_indels.paf.gz')
const simpleDelta = path.join(base, 'volvox_inv_indels.delta')
const simpleOut = path.join(base, 'volvox_inv_indels.out')
const simpleChain = path.join(base, 'volvox_inv_indels.chain')
const simpleMcScan = path.join(base, 'volvox_inv_indels.anchors')
const simpleMcScanGrape = path.join(base, 'grape.bed')
const simpleMcScanPeach = path.join(base, 'peach.bed')
const simpleMcScanSimple = path.join(base, 'volvox_inv_indels.anchors.simple')
const simpleVcf = path.join(base, 'volvox.filtered.vcf')
const simpleGtf = path.join(base, 'volvox.sorted.gtf')
const simpleGffGz = path.join(base, 'volvox.sort.gff3.gz')
const testConfig = path.join(base, 'test_config.json')

function initctx(ctx: { dir: string }) {
  return copyFile(testConfig, path.join(ctx.dir, 'config.json'))
}
function init2bit(ctx: { dir: string }) {
  return copyFile(
    path.join(base, 'simple.2bit'),
    path.join(ctx.dir, 'simple.2bit'),
  )
}

// Cleaning up exitCode in Node.js 20, xref https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

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
      expect(exists(path.join(ctx.dir, 'simple.bam'))).toBeTruthy()
      expect(exists(path.join(ctx.dir, 'simple.bam.bai'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            bamLocation: {
              locationType: 'UriLocation',
              uri: 'simple.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                locationType: 'UriLocation',
                uri: 'simple.bam.bai',
              },
            },
            sequenceAdapter: {
              twoBitLocation: {
                locationType: 'UriLocation',
                uri: 'test.2bit',
              },
              type: 'testSeqAdapter',
            },
            type: 'BamAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'simple',
          trackId: 'simple',
          type: 'AlignmentsTrack',
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
      expect(exists(ctxDir(ctx, 'simple.bam'))).toBeTruthy()
      expect(exists(ctxDir(ctx, 'simple.bam.csi'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            bamLocation: {
              locationType: 'UriLocation',
              uri: 'simple.bam',
            },
            index: {
              indexType: 'CSI',
              location: {
                locationType: 'UriLocation',
                uri: 'simple.bam.csi',
              },
            },
            sequenceAdapter: {
              twoBitLocation: {
                locationType: 'UriLocation',
                uri: 'test.2bit',
              },
              type: 'testSeqAdapter',
            },
            type: 'BamAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'simple',
          trackId: 'simple',
          type: 'AlignmentsTrack',
        },
      ])
    })
  setup
    .do(initctx)
    .command(['add-track', '/testing/in/place.bam', '--load', 'inPlace'])
    .it('adds a bam track with load inPlace', async ctx => {
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            bamLocation: {
              locationType: 'UriLocation',
              uri: '/testing/in/place.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                locationType: 'UriLocation',
                uri: '/testing/in/place.bam.bai',
              },
            },
            sequenceAdapter: {
              twoBitLocation: {
                locationType: 'UriLocation',
                uri: 'test.2bit',
              },
              type: 'testSeqAdapter',
            },
            type: 'BamAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'place',
          trackId: 'place',
          type: 'AlignmentsTrack',
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
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            bamLocation: {
              locationType: 'UriLocation',
              uri: '/testing/in/place.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                locationType: 'UriLocation',
                uri: '/something/else/random.bai',
              },
            },
            sequenceAdapter: {
              twoBitLocation: {
                locationType: 'UriLocation',
                uri: 'test.2bit',
              },
              type: 'testSeqAdapter',
            },
            type: 'BamAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'place',
          trackId: 'place',
          type: 'AlignmentsTrack',
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
      expect(exists(ctxDir(ctx, 'simple.bam'))).toBeTruthy()
      expect(exists(ctxDir(ctx, 'simple.bai'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            bamLocation: {
              locationType: 'UriLocation',
              uri: 'simple.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                locationType: 'UriLocation',
                uri: 'simple.bai',
              },
            },
            sequenceAdapter: {
              twoBitLocation: {
                locationType: 'UriLocation',
                uri: 'test.2bit',
              },
              type: 'testSeqAdapter',
            },
            type: 'BamAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'simple',
          trackId: 'simple',
          type: 'AlignmentsTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command(['add-track', simpleBam, '--load', 'copy', '--subDir', 'bam'])
    .it('adds a bam track with subDir', async ctx => {
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            bamLocation: {
              locationType: 'UriLocation',
              uri: 'bam/simple.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                locationType: 'UriLocation',
                uri: 'bam/simple.bam.bai',
              },
            },
            sequenceAdapter: {
              twoBitLocation: {
                locationType: 'UriLocation',
                uri: 'test.2bit',
              },
              type: 'testSeqAdapter',
            },
            type: 'BamAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'simple',
          trackId: 'simple',
          type: 'AlignmentsTrack',
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
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
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
              twoBitLocation: {
                locationType: 'UriLocation',
                uri: 'test.2bit',
              },
              type: 'testSeqAdapter',
            },
            type: 'BamAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'simple',
          trackId: 'simple',
          type: 'AlignmentsTrack',
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
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            bamLocation: {
              locationType: 'UriLocation',
              uri: 'simple.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                locationType: 'UriLocation',
                uri: 'simple.bam.bai',
              },
            },
            type: 'BamAdapter',
          },
          assemblyNames: ['customAssemblyName'],
          category: ['newcategory'],
          defaultRendering: 'test',
          description: 'new description',
          name: 'customName',
          trackId: 'customTrackId',
          type: 'CustomTrackType',
        },
      ])
    })

  setup
    .do(initctx)
    .command(['add-track', 'https://mysite.com/data/simple.bam'])
    .it('adds a bam track from a url', async ctx => {
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            bamLocation: {
              locationType: 'UriLocation',
              uri: 'https://mysite.com/data/simple.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                locationType: 'UriLocation',
                uri: 'https://mysite.com/data/simple.bam.bai',
              },
            },
            sequenceAdapter: {
              twoBitLocation: {
                locationType: 'UriLocation',
                uri: 'test.2bit',
              },
              type: 'testSeqAdapter',
            },
            type: 'BamAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'simple',
          trackId: 'simple',
          type: 'AlignmentsTrack',
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
      const contents = readConf(ctx)
      expect(contents.tracks).toEqual([
        {
          adapter: {
            bamLocation: {
              locationType: 'UriLocation',
              uri: 'simple.bam',
            },
            index: {
              indexType: 'BAI',
              location: {
                locationType: 'UriLocation',
                uri: 'simple.bam.bai',
              },
            },
            sequenceAdapter: {
              twoBitLocation: {
                locationType: 'UriLocation',
                uri: 'test.2bit',
              },
              type: 'testSeqAdapter',
            },

            type: 'BamAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'simple',
          trackId: 'simple',
          type: 'AlignmentsTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command(['add-track', simpleGff, '--load', 'copy'])
    .it('adds a plaintext gff', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox.sort.gff3'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            gffLocation: {
              locationType: 'UriLocation',
              uri: 'volvox.sort.gff3',
            },
            type: 'Gff3Adapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'volvox.sort',
          trackId: 'volvox.sort',
          type: 'FeatureTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command(['add-track', simpleVcf, '--load', 'copy'])
    .it('adds a plaintext vcf', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox.filtered.vcf'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            type: 'VcfAdapter',
            vcfLocation: {
              locationType: 'UriLocation',
              uri: 'volvox.filtered.vcf',
            },
          },
          assemblyNames: ['testAssembly'],
          name: 'volvox.filtered',
          trackId: 'volvox.filtered',
          type: 'VariantTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command(['add-track', simpleGtf, '--load', 'copy'])
    .it('adds a plaintext gtf', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox.sorted.gtf'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            gtfLocation: {
              locationType: 'UriLocation',
              uri: 'volvox.sorted.gtf',
            },
            type: 'GtfAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'volvox.sorted',
          trackId: 'volvox.sorted',
          type: 'FeatureTrack',
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
      expect(exists(ctxDir(ctx, 'volvox.sort.gff3.gz'))).toBeTruthy()
      expect(exists(ctxDir(ctx, 'volvox.sort.gff3.gz.csi'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            gffGzLocation: {
              locationType: 'UriLocation',
              uri: 'volvox.sort.gff3.gz',
            },
            index: {
              indexType: 'CSI',
              location: {
                locationType: 'UriLocation',
                uri: 'volvox.sort.gff3.gz.csi',
              },
            },
            type: 'Gff3TabixAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'volvox.sort.gff3',
          trackId: 'volvox.sort.gff3',
          type: 'FeatureTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command([
      'add-track',
      simplePafGz,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--load',
      'copy',
    ])
    .it('adds a paf gz file', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox_inv_indels.paf.gz'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            assemblyNames: ['volvox_random_inv', 'volvox'],
            pafLocation: {
              locationType: 'UriLocation',
              uri: 'volvox_inv_indels.paf.gz',
            },
            type: 'PAFAdapter',
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
          name: 'volvox_inv_indels.paf',
          trackId: 'volvox_inv_indels.paf',
          type: 'SyntenyTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command([
      'add-track',
      simplePaf,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--load',
      'copy',
    ])
    .it('adds a paf file', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox_inv_indels.paf'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            assemblyNames: ['volvox_random_inv', 'volvox'],
            pafLocation: {
              locationType: 'UriLocation',
              uri: 'volvox_inv_indels.paf',
            },
            type: 'PAFAdapter',
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
          name: 'volvox_inv_indels',
          trackId: 'volvox_inv_indels',
          type: 'SyntenyTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command([
      'add-track',
      simpleDelta,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--load',
      'copy',
    ])
    .it('adds a delta file', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox_inv_indels.delta'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            assemblyNames: ['volvox_random_inv', 'volvox'],
            deltaLocation: {
              locationType: 'UriLocation',
              uri: 'volvox_inv_indels.delta',
            },
            type: 'DeltaAdapter',
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
          name: 'volvox_inv_indels',
          trackId: 'volvox_inv_indels',
          type: 'SyntenyTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command([
      'add-track',
      simpleOut,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--load',
      'copy',
    ])
    .it('adds a mashmap file', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox_inv_indels.out'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            assemblyNames: ['volvox_random_inv', 'volvox'],
            outLocation: {
              locationType: 'UriLocation',
              uri: 'volvox_inv_indels.out',
            },
            type: 'MashMapAdapter',
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
          name: 'volvox_inv_indels',
          trackId: 'volvox_inv_indels',
          type: 'SyntenyTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command([
      'add-track',
      simpleMcScanSimple,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--bed1',
      simpleMcScanGrape,
      '--bed2',
      simpleMcScanPeach,
      '--load',
      'copy',
    ])
    .it('adds a mcscan simpleanchors file', async ctx => {
      expect(
        exists(ctxDir(ctx, 'volvox_inv_indels.anchors.simple')),
      ).toBeTruthy()
      expect(exists(ctxDir(ctx, 'grape.bed'))).toBeTruthy()
      expect(exists(ctxDir(ctx, 'peach.bed'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            assemblyNames: ['volvox_random_inv', 'volvox'],
            bed1Location: {
              locationType: 'UriLocation',
              uri: 'grape.bed',
            },
            bed2Location: {
              locationType: 'UriLocation',
              uri: 'peach.bed',
            },
            mcscanSimpleAnchorsLocation: {
              locationType: 'UriLocation',
              uri: 'volvox_inv_indels.anchors.simple',
            },
            type: 'MCScanSimpleAnchorsAdapter',
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
          name: 'volvox_inv_indels.anchors',
          trackId: 'volvox_inv_indels.anchors',
          type: 'SyntenyTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command([
      'add-track',
      simpleMcScan,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--bed1',
      simpleMcScanGrape,
      '--bed2',
      simpleMcScanPeach,
      '--load',
      'copy',
    ])
    .it('adds a mcscan anchors file', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox_inv_indels.anchors'))).toBeTruthy()
      expect(exists(ctxDir(ctx, 'grape.bed'))).toBeTruthy()
      expect(exists(ctxDir(ctx, 'peach.bed'))).toBeTruthy()

      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            assemblyNames: ['volvox_random_inv', 'volvox'],
            bed1Location: {
              locationType: 'UriLocation',
              uri: 'grape.bed',
            },
            bed2Location: {
              locationType: 'UriLocation',
              uri: 'peach.bed',
            },
            mcscanAnchorsLocation: {
              locationType: 'UriLocation',
              uri: 'volvox_inv_indels.anchors',
            },
            type: 'MCScanAnchorsAdapter',
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
          name: 'volvox_inv_indels',
          trackId: 'volvox_inv_indels',
          type: 'SyntenyTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command([
      'add-track',
      simpleChain,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--load',
      'copy',
    ])
    .it('adds a liftover chain file', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox_inv_indels.chain'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            assemblyNames: ['volvox_random_inv', 'volvox'],
            chainLocation: {
              locationType: 'UriLocation',
              uri: 'volvox_inv_indels.chain',
            },
            type: 'ChainAdapter',
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
          name: 'volvox_inv_indels',
          trackId: 'volvox_inv_indels',
          type: 'SyntenyTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command(['add-track', simpleGffGz, '--load', 'copy'])
    .it('adds a tabix gff', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox.sort.gff3.gz'))).toBeTruthy()
      expect(exists(ctxDir(ctx, 'volvox.sort.gff3.gz.tbi'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            gffGzLocation: {
              locationType: 'UriLocation',
              uri: 'volvox.sort.gff3.gz',
            },
            index: {
              indexType: 'TBI',
              location: {
                locationType: 'UriLocation',
                uri: 'volvox.sort.gff3.gz.tbi',
              },
            },
            type: 'Gff3TabixAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'volvox.sort.gff3',
          trackId: 'volvox.sort.gff3',
          type: 'FeatureTrack',
        },
      ])
    })

  setup
    .do(initctx)
    .command(['add-track', simpleBed, '--load', 'copy'])
    .it('adds a bed track', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox.bed'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            bedLocation: {
              locationType: 'UriLocation',
              uri: 'volvox.bed',
            },
            type: 'BedAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'volvox',
          trackId: 'volvox',
          type: 'FeatureTrack',
        },
      ])
    })
  setup
    .do(initctx)
    .command(['add-track', simpleBedpe, '--load', 'copy'])
    .it('adds a bedpe track', async ctx => {
      expect(exists(ctxDir(ctx, 'volvox.bedpe'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          adapter: {
            bedpeLocation: {
              locationType: 'UriLocation',
              uri: 'volvox.bedpe',
            },
            type: 'BedpeAdapter',
          },
          assemblyNames: ['testAssembly'],
          name: 'volvox',
          trackId: 'volvox',
          type: 'VariantTrack',
        },
      ])
    })
})
