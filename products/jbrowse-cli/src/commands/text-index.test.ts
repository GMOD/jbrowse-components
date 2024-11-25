/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'
import { runCommand } from '@oclif/test'
import nock from 'nock'

// locals
import { dataDir, runInTmpDir } from '../testUtil'

const configPath = dataDir('indexing_config.json')
const volvoxDir = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'test_data',
  'volvox',
)

const ixLoc = (loc: string, b = 'volvox') => path.join(loc, 'trix', `${b}.ix`)
const ixxLoc = (loc: string, b = 'volvox') => path.join(loc, 'trix', `${b}.ixx`)

function readText(str: string) {
  return fs.readFileSync(str, 'utf8')
}

function readJSON(str: string) {
  return JSON.parse(readText(str))
}

function readTrix(d: string, s: string) {
  return readText(path.join(d, 'trix', s))
}
function readTrixJSON(d: string, s: string) {
  return JSON.parse(readTrix(d, s), (key, value) =>
    key === 'dateCreated' ? 'test' : value,
  )
}

function verifyIxxFiles(ctx: string, base = 'volvox') {
  const ixdata = readText(ixLoc(ctx, base))
  const ixxdata = readText(ixxLoc(ctx, base))
  expect(ixdata.slice(0, 1000)).toMatchSnapshot()
  expect(ixdata.slice(-1000)).toMatchSnapshot()
  expect(ixdata.length).toMatchSnapshot()
  expect(ixxdata).toMatchSnapshot()
}

// Cleaning up exitCode in Node.js 20, xref
// https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

test('fails if no track ids are provided with --tracks flag.', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['text-index', '--tracks'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('fails if there is an invalid flag', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['text-index', '--Command'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('indexes a local non-gz gff3 file', async () => {
  await runInTmpDir(async ctx => {
    const gff3File = dataDir('au9_scaffold_subset_sync.gff3')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=au9_scaffold',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})
test('indexes a local gz gff3 file', async () => {
  await runInTmpDir(async ctx => {
    // Gzipped File
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=gff3tabix_genes',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})
test('indexes a remote gz gff3 file', async () => {
  await runInTmpDir(async ctx => {
    nock('https://github.com')
      .get(
        '/GMOD/jbrowse-components/raw/main/test_data/volvox/volvox.sort.gff3.gz',
      )
      .reply(200, fs.createReadStream(dataDir('volvox.sort.gff3.gz')))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=online_gff3tabix_genes',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

test('indexes a remote non-gz gff3 file', async () => {
  await runInTmpDir(async ctx => {
    nock('https://raw.githubusercontent.com')
      .get('/GMOD/jbrowse/master/tests/data/au9_scaffold_subset_sync.gff3')
      .reply(200, () =>
        fs.createReadStream(dataDir('au9_scaffold_subset_sync.gff3')),
      )
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=online_au9_scaffold',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

test('indexes multiple local gff3 files', async () => {
  await runInTmpDir(async ctx => {
    const gff3File = dataDir('volvox.sort.gff3.gz')
    const gff3File2 = dataDir('au9_scaffold_subset_sync.gff3')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(gff3File2, path.join(ctx.dir, path.basename(gff3File2)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=gff3tabix_genes,au9_scaffold',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

test('indexes multiple remote gff3 file', async () => {
  await runInTmpDir(async ctx => {
    nock('https://github.com')
      .get(
        '/GMOD/jbrowse-components/raw/main/test_data/volvox/volvox.sort.gff3.gz',
      )
      .reply(200, fs.createReadStream(dataDir('volvox.sort.gff3.gz')))

    nock('https://raw.githubusercontent.com')
      .get('/GMOD/jbrowse/master/tests/data/au9_scaffold_subset_sync.gff3')
      .reply(200, () =>
        fs.createReadStream(dataDir('au9_scaffold_subset_sync.gff3')),
      )
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=online_gff3tabix_genes,online_au9_scaffold',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

test('indexes a remote and a local file', async () => {
  await runInTmpDir(async ctx => {
    nock('https://raw.githubusercontent.com')
      .get('/GMOD/jbrowse/master/tests/data/au9_scaffold_subset_sync.gff3')
      .reply(200, () =>
        fs.createReadStream(dataDir('au9_scaffold_subset_sync.gff3')),
      )
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=gff3tabix_genes,online_au9_scaffold',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

test('indexes a track using only the attributes tag', async () => {
  await runInTmpDir(async ctx => {
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=noAttributes',
      '--target=config.json',
      '--attributes=ID',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

// no attributes in track
test('indexes a track with no attributes in the config', async () => {
  await runInTmpDir(async ctx => {
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=noAttributes',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})
test('indexes with multiple per-file args', async () => {
  await runInTmpDir(async ctx => {
    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })
    await runCommand([
      'text-index',
      '--file',
      'volvox.sort.gff3.gz',
      '--file',
      'volvox.filtered.vcf.gz',
    ])
    verifyIxxFiles(ctx.dir, 'aggregate')
  })
})

test('indexes with  single per-file arg', async () => {
  await runInTmpDir(async ctx => {
    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })
    await runCommand(['text-index', '--file', 'volvox.sort.gff3.gz'])
    verifyIxxFiles(ctx.dir, 'volvox.sort.gff3.gz')
  })
})

test('indexes single assembly volvox config', async () => {
  await runInTmpDir(async ctx => {
    let preVolvoxIx = ''
    let preVolvoxIxx = ''
    let preVolvoxMeta = ''

    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })
    const volvoxConfig = readJSON(path.join(ctx.dir, 'config.json'))
    const assembly = volvoxConfig.assemblies[0]
    volvoxConfig.assemblies = undefined
    fs.writeFileSync(
      path.join(ctx.dir, 'config.json'),
      JSON.stringify({ ...volvoxConfig, assembly }),
    )

    preVolvoxIx = readTrix(ctx.dir, 'volvox.ix')
    preVolvoxIxx = readTrix(ctx.dir, 'volvox.ixx')
    preVolvoxMeta = readTrixJSON(ctx.dir, 'volvox_meta.json')
    await runCommand([
      'text-index',
      '--target=config.json',
      '--force',
      '--attributes',
      'Name,ID,Note',
    ])
    // to update (e.g. if volvox config is updated) run:
    // bin/dev text-index --out ../../test_data/volvox/ --attributes Name,ID,Note --force
    expect(readTrix(ctx.dir, 'volvox.ix')).toEqual(preVolvoxIx)
    expect(readTrix(ctx.dir, 'volvox.ixx')).toEqual(preVolvoxIxx)
    expect(readTrixJSON(ctx.dir, 'volvox_meta.json')).toEqual(preVolvoxMeta)
  })
})

test('indexes entire volvox config', async () => {
  await runInTmpDir(async ctx => {
    let preVolvoxIx = ''
    let preVolvoxIxx = ''
    let preVolvoxMeta = ''

    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })

    preVolvoxIx = readTrix(ctx.dir, 'volvox.ix')
    preVolvoxIxx = readTrix(ctx.dir, 'volvox.ixx')
    preVolvoxMeta = readTrixJSON(ctx.dir, 'volvox_meta.json')
    await runCommand([
      'text-index',
      '--target=config.json',
      '--force',
      '--attributes',
      'Name,ID,Note',
    ])
    // to update (e.g. if volvox config is updated) run:
    // bin/dev text-index --out ../../test_data/volvox/ --attributes Name,ID,Note --force
    expect(readTrix(ctx.dir, 'volvox.ix')).toEqual(preVolvoxIx)
    expect(readTrix(ctx.dir, 'volvox.ixx')).toEqual(preVolvoxIxx)
    expect(readTrixJSON(ctx.dir, 'volvox_meta.json')).toEqual(preVolvoxMeta)
  })
})
