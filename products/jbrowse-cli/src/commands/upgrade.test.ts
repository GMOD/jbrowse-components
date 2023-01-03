/**
 * @jest-environment node
 */

import fs, { mkdirSync } from 'fs'
import path from 'path'
import { Scope } from 'nock'
import { setup } from '../testUtil'

const { stat, readdir } = fs.promises

const releaseArray = [
  {
    tag_name: 'v0.0.2',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/JBrowse2-0.0.2.zip',
        name: 'jbrowse-web-v0.0.2.zip',
      },
    ],
  },
  {
    tag_name: 'v0.0.1',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/JBrowse2-0.0.1.zip',
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
    .reply(200, releaseArray[1])
}

function mockReleases(gitHubApi: Scope) {
  return gitHubApi
    .get('/repos/GMOD/jbrowse-components/releases?page=1')
    .reply(200, releaseArray)
}

function mockWrongSite(exampleSite: Scope) {
  return exampleSite
    .get('/JBrowse2-0.0.1.json')
    .reply(200, 'I am the wrong type', { 'Content-Type': 'application/json' })
}

function mockV1Zip(exampleSite: Scope) {
  return exampleSite
    .get('/JBrowse2-0.0.1.zip')
    .replyWithFile(
      200,
      path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
      { 'Content-Type': 'application/zip' },
    )
}

function mockV2Zip(exampleSite: Scope) {
  return exampleSite
    .get('/JBrowse2-0.0.2.zip')
    .replyWithFile(
      200,
      path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
    )
}

describe('upgrade', () => {
  setup
    .do(() => {
      mkdirSync('jbrowse')
    })
    .command(['upgrade', 'jbrowse'])
    .exit(10)
    .it(
      'fails if user selects a directory that does not have a JBrowse installation',
    )
  setup
    .command(['upgrade', 'jbrowse'])
    .exit(10)
    .it('fails if user selects a directory that does not exist')
  setup
    .nock('https://api.github.com', mockReleases)
    .nock('https://example.com', mockV2Zip)
    .add('prevStat', ctx => stat(path.join(ctx.dir, 'manifest.json')))
    .command(['upgrade'])
    .it('upgrades a directory', async ctx => {
      expect(await readdir(ctx.dir)).toContain('manifest.json')
      // upgrade successful if it updates stats of manifest json
      expect(await stat('manifest.json')).not.toEqual(ctx.prevStat)
    })
  setup
    .nock('https://api.github.com', mockTagSuccess)
    .nock('https://example.com', mockV1Zip)
    .command(['upgrade', '--tag', 'v0.0.1'])
    .it('upgrades a directory with a specific version', async ctx => {
      expect(await readdir(ctx.dir)).toContain('manifest.json')
    })
  setup
    .nock('https://example.com', mockV1Zip)
    .command(['upgrade', '--url', 'https://example.com/JBrowse2-0.0.1.zip'])
    .it('upgrades a directory from a url', async ctx => {
      expect(await readdir(ctx.dir)).toContain('manifest.json')
    })
  setup
    .nock('https://api.github.com', mockTagFail)
    .command(['upgrade', '--tag', 'v999.999.999'])
    .catch(/Could not find version/)
    .it('fails to upgrade if version does not exist')
  setup
    .nock('https://example.com', mockWrongSite)
    .command(['upgrade', '--url', 'https://example.com/JBrowse2-0.0.1.json'])
    .exit(2)
    .it('fails if the fetch does not return the right file')
})
