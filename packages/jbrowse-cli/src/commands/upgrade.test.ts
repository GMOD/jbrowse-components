/**
 * @jest-environment node
 */

import fs, { Stats } from 'fs'
import * as path from 'path'
import nock from 'nock'
import { setup } from '../testUtil'

const fsPromises = fs.promises
let prevStat: Stats
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
  {
    tag_name: 'JBrowse-2@v0.0.2',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/JBrowse2-0.0.2.zip',
      },
    ],
  },
]

let cwd = ''
beforeEach(() => {
  cwd = process.cwd()
})

afterEach(() => {
  process.chdir(cwd)
})
afterAll(() => {
  nock.cleanAll()
})

nock('https://api.github.com')
  .persist()
  .get('/repos/GMOD/jbrowse-components/releases')
  .reply(200, releaseArray)

nock('https://example.com')
  .get('/JBrowse2-0.0.1.zip')
  .replyWithFile(
    200,
    path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
  )
nock('https://example.com')
  .get('/JBrowse2-0.0.2.zip')
  .replyWithFile(
    200,
    path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
  )

describe('upgrade', () => {
  setup
    .command(['upgrade', path.join(__dirname, '..', '..', 'test')])
    .exit(10)
    .it(
      'fails if user selects a directory that does not have a JBrowse installation',
    )
  setup
    .command(['upgrade', path.join(__dirname, '..', '..', 'test', 'nonexist')])
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
    .do(async ctx => {
      prevStat = await fsPromises.stat(path.join(ctx.dir, 'manifest.json'))
    })
    .command(['upgrade'])
    .it('upgrades a directory', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
      // upgrade successful if it updates stats of manifest json
      expect(await fsPromises.stat('manifest.json')).not.toEqual(prevStat)
    })
  setup
    .command(['upgrade', '--tag', 'JBrowse-2@v0.0.2'])
    .it('upgrades a directory with a specific version', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
    })
  setup
    .command(['upgrade', '--tag', 'JBrowse-2@v999.999.999'])
    .exit(40)
    .it('fails to upgrade if version does not exist')
})
