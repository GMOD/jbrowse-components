/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'
import { Scope } from 'nock'
import { setup } from '../testUtil'

const fsPromises = fs.promises

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

function mockReleases(gitHubApi: Scope) {
  return gitHubApi
    .get('/repos/GMOD/jbrowse-components/releases')
    .reply(200, releaseArray)
}

function mockZip(exampleSite: Scope) {
  return exampleSite
    .get('/JBrowse2-0.0.1.zip')
    .replyWithFile(
      200,
      path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
    )
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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
    .command(['create', '.'])
    .exit(10)
    .it(
      'fails if user selects a directory that already has existing files, no force flag',
    )
  setup
    .nock('https://api.github.com', mockReleases)
    .nock('https://example.com', mockZip)
    .command(['create', 'jbrowse'])
    .it('download and unzips JBrowse 2 to new directory', async ctx => {
      await sleep(500)
      expect(await fsPromises.readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
        'manifest.json',
      )
    })
  setup
    .nock('https://api.github.com', mockReleases)
    .nock('https://example.com', mockZip)
    .command(['create', 'jbrowse', '--tag', 'JBrowse-2@v0.0.1', '--force'])
    .it(
      'overwrites and succeeds in downloading JBrowse in a non-empty directory with version #',
      async ctx => {
        await sleep(500)
        expect(
          await fsPromises.readdir(path.join(ctx.dir, 'jbrowse')),
        ).toContain('manifest.json')
      },
    )
  setup
    .nock('https://api.github.com', mockReleases)
    .command([
      'create',
      'jbrowse',
      '--tag',
      'JBrowse-2@v999.999.999',
      '--force',
    ])
    .exit(40)
    .it('fails to download a version that does not exist')
  setup
    .nock('https://api.github.com', mockReleases)
    .nock('https://example.com', mockZip)
    .command(['create', 'jbrowse'])
    .do(async () => {
      await sleep(500)
    })
    .command(['create', 'jbrowse'])
    .exit(10)
    .it('fails because this directory is already set up')
  setup
    .nock('https://api.github.com', mockReleases)
    .command(['create', '--listVersions'])
    .catch(/0/)
    .it('lists versions', ctx => {
      expect(ctx.stdoutWrite).toHaveBeenCalledWith(
        'All JBrowse versions: JBrowse-2@v0.0.1\n',
      )
    })
})
