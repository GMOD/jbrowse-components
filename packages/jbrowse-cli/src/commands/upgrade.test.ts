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
    tag_name: 'JBrowse-2@v0.0.2',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/JBrowse2-0.0.2.zip',
      },
    ],
  },
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

function mockV1Zip(exampleSite: Scope) {
  return exampleSite
    .get('/JBrowse2-0.0.1.zip')
    .replyWithFile(
      200,
      path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
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
      fsPromises.mkdir('jbrowse')
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
    .do(async () => {
      await fsPromises.writeFile('manifest.json', 'This Is Invalid JSON')
    })
    .command(['upgrade'])
    .exit(20)
    .it("fails if it can't parse manifest.json")

  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', '{"name":"NotJBrowse"}')
    })
    .command(['upgrade'])
    .exit(30)
    .it('fails if "name" in manifest.json is not "JBrowse"')
  setup
    .nock('https://api.github.com', mockReleases)
    .nock('https://example.com', mockV2Zip)
    .add('prevStat', ctx =>
      fsPromises.stat(path.join(ctx.dir, 'manifest.json')),
    )
    .command(['upgrade'])
    .it('upgrades a directory', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
      // upgrade successful if it updates stats of manifest json
      expect(await fsPromises.stat('manifest.json')).not.toEqual(ctx.prevStat)
    })
  setup
    .nock('https://api.github.com', mockReleases)
    .nock('https://example.com', mockV1Zip)
    .command(['upgrade', '--tag', 'JBrowse-2@v0.0.1'])
    .it('upgrades a directory with a specific version', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
    })
  setup
    .nock('https://api.github.com', mockReleases)
    .command(['upgrade', '--tag', 'JBrowse-2@v999.999.999'])
    .exit(40)
    .it('fails to upgrade if version does not exist')
})
