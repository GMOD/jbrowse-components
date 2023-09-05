/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'
import { Scope } from 'nock'

// locals
import { setup, dataDir, copyDir } from '../testUtil'

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

function mockRemote1(exampleSite: Scope) {
  return exampleSite
    .get('/GMOD/jbrowse/master/tests/data/au9_scaffold_subset_sync.gff3')
    .reply(200, () =>
      fs.createReadStream(dataDir('au9_scaffold_subset_sync.gff3')),
    )
}

function mockRemote2(exampleSite: Scope) {
  return exampleSite
    .get(
      '/GMOD/jbrowse-components/raw/main/test_data/volvox/volvox.sort.gff3.gz',
    )
    .reply(200, fs.createReadStream(dataDir('volvox.sort.gff3.gz')))
}

const ixLoc = (loc: string, b = 'volvox') => path.join(loc, 'trix', b + '.ix')
const ixxLoc = (loc: string, b = 'volvox') => path.join(loc, 'trix', b + '.ixx')

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

// Base text index command
// Test throwing an error if --tracks and no track ids provided
describe('textIndexCommandErrors', () => {
  setup
    .command(['text-index', '--tracks'])
    .catch('Flag --tracks expects a value')
    .it('fails if no track ids are provided to the command with --tracks flag.')

  setup
    .command(['text-index', '--Command'])
    .catch(err => expect(err.message).toContain('Nonexistent flag:'))
    .it('fails if there is an invalid flag')
})

// Non-Gzipped File
describe('text-index', () => {
  setup
    .do(async ctx => {
      const gff3File = dataDir('au9_scaffold_subset_sync.gff3')
      fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
    .command(['text-index', '--tracks=au9_scaffold', '--target=config.json'])
    .it('Indexes a local non-gz gff3 file', ctx => verifyIxxFiles(ctx.dir))
})

// Gzipped File
describe('text-index tracks', () => {
  setup
    .do(async ctx => {
      const gff3File = dataDir('volvox.sort.gff3.gz')
      fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
    .command(['text-index', '--tracks=gff3tabix_genes', '--target=config.json'])
    .it('Indexes a local gz gff3 file', ctx => verifyIxxFiles(ctx.dir))
})

// Remote GZ
describe('text-index tracks', () => {
  setup
    .nock('https://github.com', mockRemote2)
    .do(ctx => fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json')))
    .command([
      'text-index',
      '--tracks=online_gff3tabix_genes',
      '--target=config.json',
    ])
    .it('Indexes a remote gz gff3 file', ctx => verifyIxxFiles(ctx.dir))
})

// Remote Non-GZ

describe('text-index tracks', () => {
  setup
    .nock('https://raw.githubusercontent.com', mockRemote1)
    .do(ctx => fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json')))
    .command([
      'text-index',
      '--tracks=online_au9_scaffold',
      '--target=config.json',
    ])
    .it('Indexes a remote non-gz gff3 file', ctx => verifyIxxFiles(ctx.dir))
})

// 2 Local Files

describe('text-index tracks', () => {
  setup
    .do(ctx => {
      const gff3File = dataDir('volvox.sort.gff3.gz')
      const gff3File2 = dataDir('au9_scaffold_subset_sync.gff3')
      fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
      fs.copyFileSync(gff3File2, path.join(ctx.dir, path.basename(gff3File2)))
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
    .command([
      'text-index',
      '--tracks=gff3tabix_genes,au9_scaffold',
      '--target=config.json',
    ])
    .it('Indexes multiple local gff3 files', ctx => verifyIxxFiles(ctx.dir))
})

describe('text-index tracks', () => {
  setup
    .nock('https://github.com', mockRemote2)
    .nock('https://raw.githubusercontent.com', mockRemote1)
    .do(ctx => fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json')))
    .command([
      'text-index',
      '--tracks=online_gff3tabix_genes,online_au9_scaffold',
      '--target=config.json',
    ])
    .it('Indexes multiple remote gff3 file', ctx => verifyIxxFiles(ctx.dir))
})

// URL and Local
describe('text-index tracks', () => {
  setup
    .nock('https://raw.githubusercontent.com', mockRemote1)
    .do(ctx => {
      const gff3File = dataDir('volvox.sort.gff3.gz')
      fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
    .command([
      'text-index',
      '--tracks=gff3tabix_genes,online_au9_scaffold',
      '--target=config.json',
    ])
    .it('Indexes a remote and a local file', ctx => verifyIxxFiles(ctx.dir))
})

describe('text-index tracks', () => {
  setup
    .do(ctx => {
      const gff3File = dataDir('volvox.sort.gff3.gz')
      fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
    .command([
      'text-index',
      '--tracks=noAttributes',
      '--target=config.json',
      '--attributes=ID',
    ])
    .it('Indexes a track using only the attributes tag', ctx =>
      verifyIxxFiles(ctx.dir),
    )
})

// no attributes in track
describe('text-index tracks', () => {
  setup
    .do(ctx => {
      const gff3File = dataDir('volvox.sort.gff3.gz')
      fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
    .command(['text-index', '--tracks=noAttributes', '--target=config.json'])
    .it('Indexes a track with no attributes in the config', ctx =>
      verifyIxxFiles(ctx.dir),
    )
})

describe('text-index with multiple per-files', () => {
  setup
    .do(ctx => copyDir(volvoxDir, ctx.dir))
    .command([
      'text-index',
      '--file',
      'volvox.sort.gff3.gz',
      '--file',
      'volvox.filtered.vcf.gz',
    ])
    .it('Indexes with multiple per-file args', ctx =>
      verifyIxxFiles(ctx.dir, 'aggregate'),
    )
})

describe('text-index with single per-file', () => {
  setup
    .do(ctx => copyDir(volvoxDir, ctx.dir))
    .command(['text-index', '--file', 'volvox.sort.gff3.gz'])
    .it('Indexes with  single per-file arg', ctx =>
      verifyIxxFiles(ctx.dir, 'volvox.sort.gff3.gz'),
    )
})
describe('run with a single assembly similar to embedded config', () => {
  let preVolvoxIx = ''
  let preVolvoxIxx = ''
  let preVolvoxMeta = ''

  setup
    .do(async ctx => {
      await copyDir(volvoxDir, ctx.dir)
      const volvoxConfig = readJSON(path.join(ctx.dir, 'config.json'))
      const assembly = volvoxConfig.assemblies[0]
      delete volvoxConfig.assemblies
      fs.writeFileSync(
        path.join(ctx.dir, 'config.json'),
        JSON.stringify({ ...volvoxConfig, assembly }),
      )

      preVolvoxIx = readTrix(ctx.dir, 'volvox.ix')
      preVolvoxIxx = readTrix(ctx.dir, 'volvox.ixx')
      preVolvoxMeta = readTrixJSON(ctx.dir, 'volvox_meta.json')
    })
    .command([
      'text-index',
      '--target=config.json',
      '--force',
      '--attributes',
      'Name,ID,Note',
    ])
    // to update (e.g. if volvox config is updated) run:
    // bin/run text-index --out ../../test_data/volvox/ --attributes Name,ID,Note --force
    .it('Indexes single assembly volvox config', ctx => {
      expect(readTrix(ctx.dir, 'volvox.ix')).toEqual(preVolvoxIx)
      expect(readTrix(ctx.dir, 'volvox.ixx')).toEqual(preVolvoxIxx)
      expect(readTrixJSON(ctx.dir, 'volvox_meta.json')).toEqual(preVolvoxMeta)
    })
})

describe('run with a volvox config', () => {
  let preVolvoxIx = ''
  let preVolvoxIxx = ''
  let preVolvoxMeta = ''

  setup
    .do(async ctx => {
      await copyDir(volvoxDir, ctx.dir)

      preVolvoxIx = readTrix(ctx.dir, 'volvox.ix')
      preVolvoxIxx = readTrix(ctx.dir, 'volvox.ixx')
      preVolvoxMeta = readTrixJSON(ctx.dir, 'volvox_meta.json')
    })
    .command([
      'text-index',
      '--target=config.json',
      '--force',
      '--attributes',
      'Name,ID,Note',
    ])
    // to update (e.g. if volvox config is updated) run:
    // bin/run text-index --out ../../test_data/volvox/ --attributes Name,ID,Note --force
    .it('Indexes entire volvox config', ctx => {
      expect(readTrix(ctx.dir, 'volvox.ix')).toEqual(preVolvoxIx)
      expect(readTrix(ctx.dir, 'volvox.ixx')).toEqual(preVolvoxIxx)
      expect(readTrixJSON(ctx.dir, 'volvox_meta.json')).toEqual(preVolvoxMeta)
    })
})
