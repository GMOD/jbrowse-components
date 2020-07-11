/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'
import nock from 'nock'
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

const releaseArray = [
  {
    tag_name: 'JBrowse-2@v0.0.1',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/JBrowse2-0.0.1.zip',
      },
    ],
  },
]
nock('https://api.github.com')
  .persist()
  .get('/repos/GMOD/jbrowse-components/releases')
  .reply(200, releaseArray)

nock('https://example.com')
  .persist()
  .get('/JBrowse2-0.0.1.zip')
  .replyWithFile(
    200,
    path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
  )

let cwd = ''
beforeEach(() => {
  cwd = process.cwd()
})

afterEach(() => {
  process.chdir(cwd)
})
afterAll(() => {
  del(testDir, { force: true })
  nock.cleanAll()
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
    .command(['create', testDir, '--tag', 'JBrowse-2@v0.0.1', '--force'])
    .it(
      'overwrites and succeeds in downloading JBrowse in a non-empty directory with version #',
      async ctx => {
        expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
      },
    )
  setup
    .command(['create', testDir, '--tag', 'JBrowse-2@v999.999.999', '--force'])
    .exit(40)
    .it('fails to download a version that does not exist')
  setup
    .command(['create', testDir])
    .exit(10)
    .it('fails because this directory is already set up')
})
