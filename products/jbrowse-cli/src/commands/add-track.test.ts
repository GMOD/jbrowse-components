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
          type: 'AlignmentsTrack',
          trackId: 'simple',
          name: 'simple',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'simple.bam',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: 'simple.bam.bai',
                locationType: 'UriLocation',
              },
            },
            sequenceAdapter: {
              type: 'testSeqAdapter',
              twoBitLocation: {
                uri: 'test.2bit',
                locationType: 'UriLocation',
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
      expect(exists(ctxDir(ctx, 'simple.bam'))).toBeTruthy()
      expect(exists(ctxDir(ctx, 'simple.bam.csi'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'simple',
          name: 'simple',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'simple.bam',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'CSI',
              location: {
                uri: 'simple.bam.csi',
                locationType: 'UriLocation',
              },
            },
            sequenceAdapter: {
              type: 'testSeqAdapter',
              twoBitLocation: {
                uri: 'test.2bit',
                locationType: 'UriLocation',
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
      expect(readConf(ctx).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'place',
          name: 'place',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: '/testing/in/place.bam',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: '/testing/in/place.bam.bai',
                locationType: 'UriLocation',
              },
            },
            sequenceAdapter: {
              type: 'testSeqAdapter',
              twoBitLocation: {
                uri: 'test.2bit',
                locationType: 'UriLocation',
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
      expect(readConf(ctx).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'place',
          name: 'place',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: '/testing/in/place.bam',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: '/something/else/random.bai',
                locationType: 'UriLocation',
              },
            },
            sequenceAdapter: {
              type: 'testSeqAdapter',
              twoBitLocation: {
                uri: 'test.2bit',
                locationType: 'UriLocation',
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
      expect(exists(ctxDir(ctx, 'simple.bam'))).toBeTruthy()
      expect(exists(ctxDir(ctx, 'simple.bai'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'simple',
          name: 'simple',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'simple.bam',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: 'simple.bai',
                locationType: 'UriLocation',
              },
            },
            sequenceAdapter: {
              type: 'testSeqAdapter',
              twoBitLocation: {
                uri: 'test.2bit',
                locationType: 'UriLocation',
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
      expect(readConf(ctx).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'simple',
          name: 'simple',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'bam/simple.bam',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: 'bam/simple.bam.bai',
                locationType: 'UriLocation',
              },
            },
            sequenceAdapter: {
              type: 'testSeqAdapter',
              twoBitLocation: {
                uri: 'test.2bit',
                locationType: 'UriLocation',
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
      expect(readConf(ctx).tracks).toEqual([
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
                locationType: 'UriLocation',
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
      expect(readConf(ctx).tracks).toEqual([
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
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: 'simple.bam.bai',
                locationType: 'UriLocation',
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
      expect(readConf(ctx).tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'simple',
          name: 'simple',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://mysite.com/data/simple.bam',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: 'https://mysite.com/data/simple.bam.bai',
                locationType: 'UriLocation',
              },
            },
            sequenceAdapter: {
              type: 'testSeqAdapter',
              twoBitLocation: {
                uri: 'test.2bit',
                locationType: 'UriLocation',
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
      const contents = readConf(ctx)
      expect(contents.tracks).toEqual([
        {
          type: 'AlignmentsTrack',
          trackId: 'simple',
          name: 'simple',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'simple.bam',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: 'simple.bam.bai',
                locationType: 'UriLocation',
              },
            },

            sequenceAdapter: {
              twoBitLocation: {
                uri: 'test.2bit',
                locationType: 'UriLocation',
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
      expect(exists(ctxDir(ctx, 'volvox.sort.gff3'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          type: 'FeatureTrack',
          trackId: 'volvox.sort',
          name: 'volvox.sort',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'Gff3Adapter',
            gffLocation: {
              uri: 'volvox.sort.gff3',
              locationType: 'UriLocation',
            },
          },
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
          type: 'VariantTrack',
          trackId: 'volvox.filtered',
          name: 'volvox.filtered',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'VcfAdapter',
            vcfLocation: {
              uri: 'volvox.filtered.vcf',
              locationType: 'UriLocation',
            },
          },
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
          type: 'FeatureTrack',
          trackId: 'volvox.sorted',
          name: 'volvox.sorted',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'GtfAdapter',
            gtfLocation: {
              uri: 'volvox.sorted.gtf',
              locationType: 'UriLocation',
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
      expect(exists(ctxDir(ctx, 'volvox.sort.gff3.gz'))).toBeTruthy()
      expect(exists(ctxDir(ctx, 'volvox.sort.gff3.gz.csi'))).toBeTruthy()
      expect(readConf(ctx).tracks).toEqual([
        {
          type: 'FeatureTrack',
          trackId: 'volvox.sort.gff3',
          name: 'volvox.sort.gff3',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'volvox.sort.gff3.gz',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'volvox.sort.gff3.gz.csi',
                locationType: 'UriLocation',
              },
              indexType: 'CSI',
            },
          },
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
          type: 'SyntenyTrack',
          trackId: 'volvox_inv_indels.paf',
          name: 'volvox_inv_indels.paf',
          adapter: {
            type: 'PAFAdapter',
            pafLocation: {
              uri: 'volvox_inv_indels.paf.gz',
              locationType: 'UriLocation',
            },
            assemblyNames: ['volvox_random_inv', 'volvox'],
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
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
          type: 'SyntenyTrack',
          trackId: 'volvox_inv_indels',
          name: 'volvox_inv_indels',
          adapter: {
            type: 'PAFAdapter',
            pafLocation: {
              uri: 'volvox_inv_indels.paf',
              locationType: 'UriLocation',
            },
            assemblyNames: ['volvox_random_inv', 'volvox'],
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
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
          type: 'SyntenyTrack',
          trackId: 'volvox_inv_indels',
          name: 'volvox_inv_indels',
          adapter: {
            type: 'DeltaAdapter',
            assemblyNames: ['volvox_random_inv', 'volvox'],
            deltaLocation: {
              uri: 'volvox_inv_indels.delta',
              locationType: 'UriLocation',
            },
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
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
          type: 'SyntenyTrack',
          trackId: 'volvox_inv_indels',
          name: 'volvox_inv_indels',
          adapter: {
            type: 'MashMapAdapter',
            assemblyNames: ['volvox_random_inv', 'volvox'],
            outLocation: {
              uri: 'volvox_inv_indels.out',
              locationType: 'UriLocation',
            },
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
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
          type: 'SyntenyTrack',
          trackId: 'volvox_inv_indels.anchors',
          name: 'volvox_inv_indels.anchors',
          adapter: {
            type: 'MCScanSimpleAnchorsAdapter',
            assemblyNames: ['volvox_random_inv', 'volvox'],
            mcscanSimpleAnchorsLocation: {
              uri: 'volvox_inv_indels.anchors.simple',
              locationType: 'UriLocation',
            },
            bed1Location: {
              uri: 'grape.bed',
              locationType: 'UriLocation',
            },
            bed2Location: {
              uri: 'peach.bed',
              locationType: 'UriLocation',
            },
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
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
          type: 'SyntenyTrack',
          trackId: 'volvox_inv_indels',
          name: 'volvox_inv_indels',
          adapter: {
            type: 'MCScanAnchorsAdapter',
            assemblyNames: ['volvox_random_inv', 'volvox'],
            mcscanAnchorsLocation: {
              uri: 'volvox_inv_indels.anchors',
              locationType: 'UriLocation',
            },
            bed1Location: {
              uri: 'grape.bed',
              locationType: 'UriLocation',
            },
            bed2Location: {
              uri: 'peach.bed',
              locationType: 'UriLocation',
            },
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
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
          type: 'SyntenyTrack',
          trackId: 'volvox_inv_indels',
          name: 'volvox_inv_indels',
          adapter: {
            type: 'ChainAdapter',
            assemblyNames: ['volvox_random_inv', 'volvox'],
            chainLocation: {
              uri: 'volvox_inv_indels.chain',
              locationType: 'UriLocation',
            },
          },
          assemblyNames: ['volvox_random_inv', 'volvox'],
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
          type: 'FeatureTrack',
          trackId: 'volvox.sort.gff3',
          name: 'volvox.sort.gff3',
          assemblyNames: ['testAssembly'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'volvox.sort.gff3.gz',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'volvox.sort.gff3.gz.tbi',
                locationType: 'UriLocation',
              },
              indexType: 'TBI',
            },
          },
        },
      ])
    })
})
