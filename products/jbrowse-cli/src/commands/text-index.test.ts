/**
 * @jest-environment node
 */

import { setup } from '../testUtil'
import fs from 'fs'
import path from 'path'

const configPath = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'indexing_config.json',
)
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
      const gff3File = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'au9_scaffold_subset_sync.gff3',
      )
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
      const gff3File = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'volvox.sort.gff3.gz',
      )
      fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
    .command(['text-index', '--tracks=gff3tabix_genes', '--target=config.json'])
    .it('Indexes a local gz gff3 file', ctx => verifyIxxFiles(ctx.dir))
})

// Remote GZ
describe('text-index tracks', () => {
  setup
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
      const gff3File = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'volvox.sort.gff3.gz',
      )
      const gff3File2 = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'au9_scaffold_subset_sync.gff3',
      )
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
      const gff3File = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'volvox.sort.gff3.gz',
      )
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
      const gff3File = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'volvox.sort.gff3.gz',
      )
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
      const gff3File = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'volvox.sort.gff3.gz',
      )
      fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
      fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    })
    .command(['text-index', '--tracks=noAttributes', '--target=config.json'])
    .it('Indexes a track with no attributes in the config', ctx =>
      verifyIxxFiles(ctx.dir),
    )
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

describe('check that volvox data is properly indexed, re-run text-index on volvox config if fails', () => {
  let preVolvoxIx = ''
  let preVolvoxIxx = ''
  let preVolvoxMeta = ''

  setup
    .do(async ctx => {
      await copyDir(
        path.join(__dirname, '..', '..', '..', '..', 'test_data', 'volvox'),
        ctx.dir,
      )
      preVolvoxIx = readText(ctx.dir, 'volvox.ix')
      preVolvoxIxx = readText(ctx.dir, 'volvox.ixx')
      preVolvoxMeta = readJSON(ctx.dir, 'volvox_meta.json')
    })
    .command(['text-index', '--target=config.json', '--force'])
    .it('Indexes entire volvox config', ctx => {
      const postVolvoxIx = readText(ctx.dir, 'volvox.ix')
      const postVolvoxIxx = readText(ctx.dir, 'volvox.ixx')
      const postVolvoxMeta = readJSON(ctx.dir, 'volvox_meta.json')
      expect(postVolvoxIx).toEqual(preVolvoxIx)
      expect(postVolvoxIxx).toEqual(preVolvoxIxx)
      expect(postVolvoxMeta).toEqual(preVolvoxMeta)
    })
})

// This test is commented out due to how long it takes to complete
/*
// Aggregate File
describe('text-index tracks', () => {
  setup
    .do(async ctx => {
      const gff3File = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'volvox.sort.gff3.gz',
      )
      const gff3File2 = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'au9_scaffold_subset_sync.gff3',
      )
      await fsPromises.copyFile(
        gff3File,
        path.join(ctx.dir, path.basename(gff3File)),
      )
      await fsPromises.copyFile(
        gff3File2,
        path.join(ctx.dir, path.basename(gff3File2)),
      )
      await fsPromises.copyFile(
        configPath,
        path.join(ctx.dir, 'test_config.json'),
      )
      await fsPromises.rename(
        path.join(ctx.dir, 'test_config.json'),
        path.join(ctx.dir, 'config.json'),
      )
      await readFile(path.join(ctx.dir, 'config.json'), 'utf8')
    })
    .command(['text-index', `--target=${path.join('config.json')}` ])
    .it('Indexes multiple local gff3 files', async ctx => {
      const ixdata = JSON.stringify(
        readFileSync(ixLoc, {
          encoding: 'utf8',
          flag: 'r',
        }),
      )
      expect(ixdata).toMatchSnapshot()
      const ixxData = JSON.stringify(
        readFileSync(ixxLoc, {
          encoding: 'utf8',
          flag: 'r',
        }),
      )
      expect(ixxData).toMatchSnapshot()
    })
})
*/
