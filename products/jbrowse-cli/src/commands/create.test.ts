/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'
import { Scope } from 'nock'
import { setup } from '../testUtil'

const { readdir } = fs.promises

const releaseArray = [
  {
    tag_name: 'v0.0.1',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/jbrowse-web-v0.0.1.zip',
        name: 'jbrowse-web-v0.0.1.zip',
      },
    ],
  },
]

function mockTagFail(gitHubApi: Scope) {
  return gitHubApi
    .get('/repos/GMOD/jbrowse-components/releases/tags/v999.999.999')
    .reply(404, {})
}

function mockTagSuccess(gitHubApi: Scope) {
  return gitHubApi
    .get('/repos/GMOD/jbrowse-components/releases/tags/v0.0.1')
    .reply(200, releaseArray[0])
}

function mockReleases(gitHubApi: Scope) {
  return gitHubApi
    .get('/repos/GMOD/jbrowse-components/releases?page=1')
    .reply(200, releaseArray)
}

function mockReleasesListVersions(gitHubApi: Scope) {
  return gitHubApi
    .get('/repos/GMOD/jbrowse-components/releases?page=1')
    .reply(200, releaseArray)
    .get('/repos/GMOD/jbrowse-components/releases?page=2')
    .reply(200, [])
}

function mockZip(exampleSite: Scope) {
  return exampleSite
    .get('/jbrowse-web-v0.0.1.zip')
    .replyWithFile(
      200,
      path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
      { 'Content-Type': 'application/zip' },
    )
}

function mockWrongSite(exampleSite: Scope) {
  return exampleSite
    .get('/jbrowse-web-v0.0.1.json')
    .reply(200, 'I am the wrong type', { 'Content-Type': 'application/json' })
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
    .exit(120)
    .it(
      'fails if user selects a directory that already has existing files, no force flag',
    )
  setup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://example.com', mockWrongSite as any)
    .command([
      'create',
      'jbrowse',
      '--url',
      'https://example.com/jbrowse-web-v0.0.1.json',
    ])
    .exit(2)
    .it('fails if the fetch does not return the right file')
  setup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://api.github.com', mockReleases as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://example.com', mockZip as any)
    .command(['create', 'jbrowse'])
    .it('download and unzips JBrowse 2 to new directory', async ctx => {
      expect(await readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
        'manifest.json',
      )
    })
  setup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://example.com', mockZip as any)
    .command([
      'create',
      'jbrowse',
      '--url',
      'https://example.com/jbrowse-web-v0.0.1.zip',
    ])
    .it('upgrades a directory from a url', async ctx => {
      expect(await readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
        'manifest.json',
      )
    })
  setup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://api.github.com', mockTagSuccess as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://example.com', mockZip as any)
    .command(['create', 'jbrowse', '--tag', 'v0.0.1', '--force'])
    .it(
      'overwrites and succeeds in downloading JBrowse in a non-empty directory with version #',
      async ctx => {
        expect(await readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
          'manifest.json',
        )
      },
    )
  setup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://api.github.com', mockTagFail as any)
    .command(['create', 'jbrowse', '--tag', 'v999.999.999', '--force'])
    .catch(/Could not find version/)
    .it('fails to download a version that does not exist')
  setup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://api.github.com', mockReleases as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://example.com', mockZip as any)
    .command(['create', 'jbrowse'])
    .command(['create', 'jbrowse'])
    .exit(120)
    .it('fails because this directory is already set up')
  setup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .nock('https://api.github.com', mockReleasesListVersions as any)
    .command(['create', '--listVersions'])
    .catch(/0/)
    .it('lists versions', ctx => {
      expect(ctx.stdoutWrite).toHaveBeenCalledWith(
        'All JBrowse versions:\nv0.0.1\n',
      )
    })
})
