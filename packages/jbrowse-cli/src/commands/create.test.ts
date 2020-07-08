/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'
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

describe('create', () => {
  setup
    .command(['create'])
    .catch(err => {
      expect(err.message).toContain('Missing 1 required arg:')
      expect(err.message).toContain(
        'userPath  Location where JBrowse 2 will be installed',
      )
      expect(err.message).toContain('See more help with --help')
    })
    .it('fails if no path is provided to the command')

  setup
    .command(['create', '--force'])
    .catch(err => {
      expect(err.message).toContain('Missing 1 required arg:')
      expect(err.message).toContain(
        'userPath  Location where JBrowse 2 will be installed',
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
    .command(['create', testDir])
    .exit(10)
    .it('fails because this directory is already set up')

  setup
    .command(['create', testDir, '--force'])
    .it(
      'overwrites and succeeds in downloading JBrowse in a non-empty directory',
      async ctx => {
        expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
      },
    )
})

afterAll(() => fsPromises.rmdir(testDir, { recursive: true }))
