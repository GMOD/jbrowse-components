/**
 * @jest-environment node
 */

import { setup } from '../testUtil'
import fs, { readFileSync } from 'fs'
import path from 'path'
import { readFile } from 'fs-extra'

const fsPromises = fs.promises
const configPath = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'indexing_config.json',
)
const outLoc = path.join(__dirname, '..', '..', 'test', 'data')
const ixLoc = path.join(__dirname, '..', '..', 'test', 'data', 'out.ix')
const ixxLoc = path.join(__dirname, '..', '..', 'test', 'data', 'out.ixx')

// Base text index command
// Test throwing an error if --tracks and no track ids provided
describe('textIndexCommandErrors', () => {
  setup
    .command(['text-index', '--tracks'])
    .catch('Flag --tracks expects a value')
    .it('fails if no track ids are provided to the command with --tracks flag.')
  setup
    .command(['text-index', '--individual'])
    .catch('Error, please specify a track to index.')
    .it(
      'fails if no track id is provided to the command with --individual flag.',
    )
  setup
    .command(['text-index', '--individual', '--tracks=file1,gile2'])
    .catch(err => {
      expect(err.message).toContain(
        '--individual flag only allows one track to be indexed',
      )
    })
    .it('fails if there are more than one track when using the individual flag')
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
      await fsPromises.copyFile(
        gff3File,
        path.join(ctx.dir, path.basename(gff3File)),
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
    .command([
      'text-index',
      '--individual',
      '--tracks=au9_scaffold',
      `--target=${path.join('config.json')}`,
      `--location=${outLoc}`,
    ])
    .it('Indexes a local non-gz gff3 file', async () => {
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
      await fsPromises.copyFile(
        gff3File,
        path.join(ctx.dir, path.basename(gff3File)),
      )
      await fsPromises.copyFile(
        configPath,
        path.join(ctx.dir, 'test_config.json'),
      )
      await fsPromises.rename(
        path.join(ctx.dir, 'test_config.json'),
        path.join(ctx.dir, 'config.json'),
      )
      readFileSync(path.join(ctx.dir, 'config.json'), 'utf8')
    })
    .command([
      'text-index',
      '--individual',
      '--tracks=gff3tabix_genes',
      `--target=${path.join('config.json')}`,
      `--location=${outLoc}`,
    ])
    .it('Indexes a local gz gff3 file', async () => {
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

// Remote GZ
describe('text-index tracks', () => {
  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        configPath,
        path.join(ctx.dir, 'test_config.json'),
      )
      await fsPromises.rename(
        path.join(ctx.dir, 'test_config.json'),
        path.join(ctx.dir, 'config.json'),
      )
      readFileSync(path.join(ctx.dir, 'config.json'), 'utf8')
    })
    .command([
      'text-index',
      '--individual',
      '--tracks=online_gff3tabix_genes',
      `--target=${path.join('config.json')}`,
      `--location=${outLoc}`,
    ])
    .it('Indexes a remote gz gff3 file', async () => {
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

// Remote Non-GZ

describe('text-index tracks', () => {
  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        configPath,
        path.join(ctx.dir, 'test_config.json'),
      )
      await fsPromises.rename(
        path.join(ctx.dir, 'test_config.json'),
        path.join(ctx.dir, 'config.json'),
      )
      readFileSync(path.join(ctx.dir, 'config.json'), 'utf8')
    })
    .command([
      'text-index',
      '--individual',
      '--tracks=online_au9_scaffold',
      `--target=${path.join('config.json')}`,
      `--location=${outLoc}`,
    ])
    .it('Indexes a remote non-gz gff3 file', async () => {
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
      readFileSync(path.join(ctx.dir, 'config.json'), 'utf8')
    })
    .command([
      'text-index',
      '--tracks=gff3tabix_genes,au9_scaffold',
      `--target=${path.join('config.json')}`,
      `--location=${outLoc}`,
    ])
    .it('Indexes multiple local gff3 files', async () => {
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

// 2 Remote Files
describe('text-index tracks', () => {
  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        configPath,
        path.join(ctx.dir, 'test_config.json'),
      )
      await fsPromises.rename(
        path.join(ctx.dir, 'test_config.json'),
        path.join(ctx.dir, 'config.json'),
      )
      readFileSync(path.join(ctx.dir, 'config.json'), 'utf8')
    })
    .command([
      'text-index',
      '--tracks=online_gff3tabix_genes,online_au9_scaffold',
      `--target=${path.join('config.json')}`,
      `--location=${outLoc}`,
    ])
    .it('Indexes multiple remote gff3 file', async () => {
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
      await fsPromises.copyFile(
        gff3File,
        path.join(ctx.dir, path.basename(gff3File)),
      )
      await fsPromises.copyFile(
        configPath,
        path.join(ctx.dir, 'test_config.json'),
      )
      await fsPromises.rename(
        path.join(ctx.dir, 'test_config.json'),
        path.join(ctx.dir, 'config.json'),
      )
      readFileSync(path.join(ctx.dir, 'config.json'), 'utf8')
    })
    .command([
      'text-index',
      '--tracks=gff3tabix_genes,online_au9_scaffold',
      `--target=${path.join('config.json')}`,
      `--location=${outLoc}`,
    ])
    .it('Indexes a remote and a local file', async () => {
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
      await readFileSync(path.join(ctx.dir, 'config.json'), 'utf8')
    })
    .command(['text-index', `--target=${path.join('config.json')}`, `--location=${outLoc}`])
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
