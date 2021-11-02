/**
 * @jest-environment node
 */

import { setup } from '../testUtil'
import fs from 'fs'
import path from 'path'
import { Scope } from 'nock'

const dir = path.join(__dirname, '..', '..', 'test', 'data')
const configPath = path.join(dir, 'indexing_config.json')
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
      fs.createReadStream(path.join(dir, 'au9_scaffold_subset_sync.gff3')),
    )
}

function mockRemote2(exampleSite: Scope) {
  return exampleSite
    .get(
      '/GMOD/jbrowse-components/cli_trix_indexer_stub/test_data/volvox/volvox.sort.gff3.gz',
    )
    .reply(200, fs.createReadStream(path.join(dir, 'volvox.sort.gff3.gz')))
}

const ixLoc = (loc: string) => path.join(loc, 'trix', 'volvox.ix')
const ixxLoc = (loc: string) => path.join(loc, 'trix', 'volvox.ixx')

function verifyIxxFiles(ctx: string) {
  const ixdata = fs.readFileSync(ixLoc(ctx), 'utf8')
  const ixxdata = fs.readFileSync(ixxLoc(ctx), 'utf8')
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
    .catch(err => {
      expect(err.message).toContain('Unexpected argument:')
    })
    .it('fails if there is an invalid flag')
})

// Non-Gzipped File
describe('text-index', () => {
  setup
    .do(async ctx => {
      const gff3File = path.join(dir, 'au9_scaffold_subset_sync.gff3')
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
      const gff3File = path.join(dir, 'volvox.sort.gff3.gz')
      fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
    .command(['text-index', '--tracks=gff3tabix_genes', '--target=config.json'])
    .it('Indexes a local gz gff3 file', ctx => verifyIxxFiles(ctx.dir))
})

// Remote GZ
describe('text-index tracks', () => {
  setup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://raw.githubusercontent.com', mockRemote2 as any)
    .do(async ctx => {
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://raw.githubusercontent.com', mockRemote1 as any)
    .do(async ctx => {
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
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
    .do(async ctx => {
      const gff3File = path.join(dir, 'volvox.sort.gff3.gz')
      const gff3File2 = path.join(dir, 'au9_scaffold_subset_sync.gff3')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://raw.githubusercontent.com', mockRemote1 as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://raw.githubusercontent.com', mockRemote2 as any)
    .do(async ctx => {
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
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
    .do(async ctx => {
      const gff3File = path.join(dir, 'volvox.sort.gff3.gz')
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
    .do(async ctx => {
      const gff3File = path.join(dir, 'volvox.sort.gff3.gz')
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
    .do(async ctx => {
      const gff3File = path.join(dir, 'volvox.sort.gff3.gz')
      fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
    .command(['text-index', '--tracks=noAttributes', '--target=config.json'])
    .it('Indexes a track with no attributes in the config', ctx =>
      verifyIxxFiles(ctx.dir),
    )
})

describe('text-index with multiple --files', () => {
  setup
    .do(async ctx => {
      await copyDir(volvoxDir, ctx.dir)
    })
    .command([
      'text-index',
      '--file',
      'volvox.sort.gff3.gz',
      '--file',
      'volvox.filtered.vcf.gz',
    ])
    .it('Indexes with --file', ctx => {
      const ixdata = fs.readFileSync(
        path.join(ctx.dir, 'trix', 'aggregate.ix'),
        'utf8',
      )
      const ixxdata = fs.readFileSync(
        path.join(ctx.dir, 'trix', 'aggregate.ixx'),
        'utf8',
      )
      expect(ixdata.slice(0, 1000)).toMatchSnapshot()
      expect(ixdata.slice(-1000)).toMatchSnapshot()
      expect(ixdata.length).toMatchSnapshot()
      expect(ixxdata).toMatchSnapshot()
    })
})

describe('text-index with single --file', () => {
  setup
    .do(async ctx => {
      await copyDir(volvoxDir, ctx.dir)
    })
    .command(['text-index', '--file', 'volvox.sort.gff3.gz'])
    .it('Indexes with --file', ctx => {
      const ixdata = fs.readFileSync(
        path.join(ctx.dir, 'trix', 'volvox.sort.gff3.gz.ix'),
        'utf8',
      )
      const ixxdata = fs.readFileSync(
        path.join(ctx.dir, 'trix', 'volvox.sort.gff3.gz.ixx'),
        'utf8',
      )
      expect(ixdata.slice(0, 1000)).toMatchSnapshot()
      expect(ixdata.slice(-1000)).toMatchSnapshot()
      expect(ixdata.length).toMatchSnapshot()
      expect(ixxdata).toMatchSnapshot()
    })
})

// source https://stackoverflow.com/a/64255382/2129219
async function copyDir(src: string, dest: string) {
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = await fs.promises.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    entry.isDirectory()
      ? await copyDir(srcPath, destPath)
      : await fs.promises.copyFile(srcPath, destPath)
  }
}

describe('run with a single assembly similar to embedded config', () => {
  let preVolvoxIx = ''
  let preVolvoxIxx = ''
  let preVolvoxMeta = ''

  function readText(d: string, s: string) {
    return fs.readFileSync(path.join(d, 'trix', s), 'utf8')
  }
  function readJSON(d: string, s: string) {
    return JSON.parse(readText(d, s), function (key, value) {
      if (key === 'dateCreated') {
        return 'test'
      } else {
        return value
      }
    })
  }

  setup
    .do(async ctx => {
      await copyDir(volvoxDir, ctx.dir)
      const volvoxConfig = JSON.parse(
        fs.readFileSync(path.join(ctx.dir, 'config.json'), 'utf8'),
      )
      const assembly = volvoxConfig.assemblies[0]
      delete volvoxConfig.assemblies
      fs.writeFileSync(
        path.join(ctx.dir, 'config.json'),
        JSON.stringify({ ...volvoxConfig, assembly }),
      )

      preVolvoxIx = readText(ctx.dir, 'volvox.ix')
      preVolvoxIxx = readText(ctx.dir, 'volvox.ixx')
      preVolvoxMeta = readJSON(ctx.dir, 'volvox_meta.json')
    })
    .command([
      'text-index',
      '--target=config.json',
      '--force',
      '--attributes',
      'Name,ID,Note',
    ])
    .it('Indexes single assembly volvox config', ctx => {
      const postVolvoxIx = readText(ctx.dir, 'volvox.ix')
      const postVolvoxIxx = readText(ctx.dir, 'volvox.ixx')
      const postVolvoxMeta = readJSON(ctx.dir, 'volvox_meta.json')
      expect(postVolvoxIx).toEqual(preVolvoxIx)
      expect(postVolvoxIxx).toEqual(preVolvoxIxx)
      expect(postVolvoxMeta).toEqual(preVolvoxMeta)
    })
})

describe('run with a volvox config', () => {
  let preVolvoxIx = ''
  let preVolvoxIxx = ''
  let preVolvoxMeta = ''

  function readText(d: string, s: string) {
    return fs.readFileSync(path.join(d, 'trix', s), 'utf8')
  }
  function readJSON(d: string, s: string) {
    return JSON.parse(readText(d, s), function (key, value) {
      if (key === 'dateCreated') {
        return 'test'
      } else {
        return value
      }
    })
  }

  setup
    .do(async ctx => {
      await copyDir(volvoxDir, ctx.dir)

      preVolvoxIx = readText(ctx.dir, 'volvox.ix')
      preVolvoxIxx = readText(ctx.dir, 'volvox.ixx')
      preVolvoxMeta = readJSON(ctx.dir, 'volvox_meta.json')
    })
    .command([
      'text-index',
      '--target=config.json',
      '--force',
      '--attributes',
      'Name,ID,Note',
    ])
    .it('Indexes entire volvox config', ctx => {
      const postVolvoxIx = readText(ctx.dir, 'volvox.ix')
      const postVolvoxIxx = readText(ctx.dir, 'volvox.ixx')
      const postVolvoxMeta = readJSON(ctx.dir, 'volvox_meta.json')
      expect(postVolvoxIx).toEqual(preVolvoxIx)
      expect(postVolvoxIxx).toEqual(preVolvoxIxx)
      expect(postVolvoxMeta).toEqual(preVolvoxMeta)
    })
})
