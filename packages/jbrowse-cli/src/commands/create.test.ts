/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'
import del from 'del'
import { setup } from '../testUtil'

const fsPromises = fs.promises
const testDir = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'createTestDir',
)

beforeAll(done => {
  done()
})
afterAll(async done => {
  await del(testDir, { force: true })
  done()
})

describe('create', () => {
  setup
    .command(['create'])
    .catch(err => {
      expect(err.message).toContain('Missing 1 required arg:')
      expect(err.message).toContain(
        'localPath  Location where JBrowse 2 will be installed',
      )
      expect(err.message).toContain('See more help with --help')
    })
    .it('fails if no path is provided to the command')

  setup
    .command(['create', '--force'])
    .catch(err => {
      expect(err.message).toContain('Missing 1 required arg:')
      expect(err.message).toContain(
        'localPath  Location where JBrowse 2 will be installed',
      )
      expect(err.message).toContain('See more help with --help')
    })
    .it('fails if no path is provided to the command even with force')
  setup
    .command(['create', path.join(__dirname, '..', '..', 'test')])
    .exit(10)
    .it(
      'fails if user selects a directory that already has existing files, no force flag',
    )
  setup
    .do(async () => {
      await fsPromises.mkdir(testDir)
    })
    .command(['create', testDir])
    .it('download and unzips JBrowse 2 to new directory', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
    })

  setup
    .command(['create', testDir, '0.0.2', '--force'])
    .it(
      'overwrites and succeeds in downloading JBrowse in a non-empty directory with version #',
      async ctx => {
        expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
      },
    )
  setup
    .command(['create', testDir, '999.999.999', '--force'])
    .exit(40)
    .it('fails to download a version that does not exist')
  setup
    .command(['create', testDir])
    .exit(10)
    .it('fails because this directory is already set up')
})
