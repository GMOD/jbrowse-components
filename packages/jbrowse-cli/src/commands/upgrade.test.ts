/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'
import { Scope } from 'nock'
import { setup } from '../testUtil'

const fsPromises = fs.promises

function mockVersionsJson(s3: Scope) {
  return s3.get('/jbrowse.org/jb2_releases/versions.json').reply(200, {
    versions: ['0.0.1'],
  })
}

function mockZipFile(s3: Scope) {
  return s3
    .get('/jbrowse.org/jb2_releases/JBrowse2_version_0.0.1.zip')
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
    .nock('https://s3.amazonaws.com', mockVersionsJson)
    .nock('https://s3.amazonaws.com', mockZipFile)
    .add('prevStat', ctx =>
      fsPromises.stat(path.join(ctx.dir, 'manifest.json')),
    )
    .command(['upgrade'])
    .it('upgrades a directory', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
      // upgrade successful if it updates stats of manifest json
      expect(await fsPromises.stat('manifest.json')).not.toEqual(ctx.prevStat)
    })
})
