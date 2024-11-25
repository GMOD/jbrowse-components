/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

import { runCommand } from '@oclif/test'
import { readConf, ctxDir, runInTmpDir } from '../testUtil'

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

test('fails if no track is specified', async () => {
  const { error } = await runCommand(['add-track'])
  expect(error?.message).toMatchSnapshot()
})

test('fails if load flag is not passed in for a localFile', async () => {
  const { error } = await runCommand(['add-track', simpleBam])
  expect(error?.message).toMatchSnapshot()
})

test('fails if URL with load flag is passed', async () => {
  const { error } = await runCommand([
    'add-track',
    'https://mysite.com/data/simple.bam',
    '--load',
    'inPlace',
  ])
  expect(error?.message).toMatchSnapshot()
})

test('cannot add a track with the same track id', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand(['add-track', simpleBam, '--load', 'copy'])
    const { error } = await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
    ])
    expect(error?.message).toMatchSnapshot()
  })
})

test('use force to overwrite a symlink', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand(['add-track', simpleBam, '--load', 'symlink'])
    const { error } = await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'symlink',
      '--force',
    ])
    expect(error).toBe(undefined)
  })
})

test('use force to overwrite a copied file', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand(['add-track', simpleBam, '--load', 'copy'])
    const { error } = await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--force',
    ])
    expect(error).toBe(undefined)
  })
})

// setting up a test for move difficult currently, because it would literally
// move the file in our test data...
//
//   .do(initctx)
//   .do(async ctx => {
//     await fsPromises.copyFile(simpleBam, path.join(ctx.dir, 'new.bam'))
//     await fsPromises.copyFile(simpleBai, path.join(ctx.dir, 'new.bam.bai'))
//   })
//   runCommand(['add-track', 'new.bam', '--load', 'move'])
//   runCommand(['add-track', 'new.bam', '--load', 'move', '--force'])
//   .it('use force to overwrite a moved file')

test('cannot add a track if there is no config file', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
    ])
    expect(error?.message).toMatchSnapshot()
  })
})
test('fails if it cannot assume the assemblyname', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await writeFile(path.join(ctx.dir, 'config.json'), '{"assemblies":[]}')
    const { error } = await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
    ])

    expect(error?.message).toMatchSnapshot()
  })
})

test('adds a bam track with bai', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand(['add-track', simpleBam, '--load', 'copy'])
    expect(exists(path.join(ctx.dir, 'simple.bam'))).toBeTruthy()
    expect(exists(path.join(ctx.dir, 'simple.bam.bai'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a bam track with csi', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--indexFile',
      `${simpleBam}.csi`,
    ])
    expect(exists(path.join(ctx.dir, 'simple.bam'))).toBeTruthy()
    expect(exists(path.join(ctx.dir, 'simple.bam.csi'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a bam track with load inPlace', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand([
      'add-track',
      '/testing/in/place.bam',
      '--load',
      'inPlace',
    ])
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a bam+bai track with load inPlace', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand([
      'add-track',
      '/testing/in/place.bam',
      '--load',
      'inPlace',
      '--indexFile',
      '/something/else/random.bai',
    ])
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a bam track with indexFile for bai', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--indexFile',
      simpleBai,
    ])
    expect(exists(ctxDir(ctx, 'simple.bam'))).toBeTruthy()
    expect(exists(ctxDir(ctx, 'simple.bai'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a bam track with subDir', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--subDir',
      'bam',
    ])

    expect(exists(ctxDir(ctx, 'bam/simple.bam'))).toBeTruthy()
    expect(exists(ctxDir(ctx, 'bam/simple.bam.bai'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a bam track with subDir and localPath protocol', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--protocol',
      'localPath',
      '--subDir',
      'bam',
    ])

    expect(exists(ctxDir(ctx, 'bam/simple.bam'))).toBeTruthy()
    expect(exists(ctxDir(ctx, 'bam/simple.bam.bai'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a bam track with all the custom fields', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--name',
      'customName',
      '--trackId',
      'customTrackId',
      '--description',
      '"new description"',
      '--trackType',
      'CustomTrackType',
      '--category',
      'newcategory',
      '--assemblyNames',
      'customAssemblyName',
      '--config',
      '{"defaultRendering":"test"}',
    ])

    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a bam track from a url', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand(['add-track', 'https://mysite.com/data/simple.bam'])

    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('fails multiple assemblies exist but no assemblyNames passed', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await init2bit(ctx)

    await runCommand(['add-assembly', 'simple.2bit', '--load', 'copy'])
    const { error } = await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
    ])

    expect(error?.message).toMatchSnapshot()
  })
})

test('adds a track to a config with multiple assemblies', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await init2bit(ctx)

    await runCommand(['add-assembly', 'simple.2bit', '--load', 'copy'])
    const { error } = await runCommand([
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--assemblyNames',
      'testAssembly',
    ])

    expect(error).toBe(undefined)
  })
})

test('adds a plaintext gff', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand(['add-track', simpleGff, '--load', 'copy'])
    expect(exists(ctxDir(ctx, 'volvox.sort.gff3'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a plaintext vcf', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand(['add-track', simpleVcf, '--load', 'copy'])
    expect(exists(ctxDir(ctx, 'volvox.filtered.vcf'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a plaintext gtf', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand(['add-track', simpleGtf, '--load', 'copy'])
    expect(exists(ctxDir(ctx, 'volvox.sorted.gtf'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a plaintext bed', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand(['add-track', simpleBed, '--load', 'copy'])

    expect(exists(ctxDir(ctx, 'volvox.bed'))).toBeTruthy()

    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a plaintext bedpe', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand(['add-track', simpleBedpe, '--load', 'copy'])

    expect(exists(ctxDir(ctx, 'volvox.bedpe'))).toBeTruthy()

    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a tabix gff with tbi', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand(['add-track', simpleGffGz, '--load', 'copy'])

    expect(exists(ctxDir(ctx, 'volvox.sort.gff3.gz'))).toBeTruthy()
    expect(exists(ctxDir(ctx, 'volvox.sort.gff3.gz.tbi'))).toBeTruthy()

    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a tabix gff with csi', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand([
      'add-track',
      simpleGffGz,
      '--load',
      'copy',
      '--indexFile',
      `${simpleGffGz}.csi`,
    ])

    expect(exists(ctxDir(ctx, 'volvox.sort.gff3.gz'))).toBeTruthy()
    expect(exists(ctxDir(ctx, 'volvox.sort.gff3.gz.csi'))).toBeTruthy()

    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a paf.gz file', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand([
      'add-track',
      simplePafGz,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--load',
      'copy',
    ])
    expect(exists(ctxDir(ctx, 'volvox_inv_indels.paf.gz'))).toBeTruthy()

    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a paf file', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand([
      'add-track',
      simplePaf,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--load',
      'copy',
    ])

    expect(exists(ctxDir(ctx, 'volvox_inv_indels.paf'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a delta file', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand([
      'add-track',
      simpleDelta,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--load',
      'copy',
    ])

    expect(exists(ctxDir(ctx, 'volvox_inv_indels.delta'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a mashmap file', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand([
      'add-track',
      simpleOut,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--load',
      'copy',
    ])

    expect(exists(ctxDir(ctx, 'volvox_inv_indels.out'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a mcscan simple anchors file', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand([
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
    expect(exists(ctxDir(ctx, 'volvox_inv_indels.anchors.simple'))).toBeTruthy()
    expect(exists(ctxDir(ctx, 'grape.bed'))).toBeTruthy()
    expect(exists(ctxDir(ctx, 'peach.bed'))).toBeTruthy()

    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a mcscan anchors file', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand([
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
    expect(exists(ctxDir(ctx, 'volvox_inv_indels.anchors'))).toBeTruthy()
    expect(exists(ctxDir(ctx, 'grape.bed'))).toBeTruthy()
    expect(exists(ctxDir(ctx, 'peach.bed'))).toBeTruthy()

    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})

test('adds a chain file', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)

    await runCommand([
      'add-track',
      simpleChain,
      '--assemblyNames',
      'volvox_random_inv,volvox',
      '--load',
      'copy',
    ])
    expect(exists(ctxDir(ctx, 'volvox_inv_indels.chain'))).toBeTruthy()
    expect(readConf(ctx).tracks).toMatchSnapshot()
  })
})
