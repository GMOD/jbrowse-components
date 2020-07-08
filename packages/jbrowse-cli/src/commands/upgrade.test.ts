/**
 * @jest-environment node
 */

import fs, { Stats } from 'fs'
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
let prevStat: Stats

describe('upgrade', () => {
  setup
    .command(['upgrade', path.join(__dirname, '..', '..', 'test')])
    .exit(10)
    .it(
      'fails if user selects a directory that does not have a JBrowse installation',
    )
  setup
    .command(['upgrade', testDir])
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
  // mock call using nock
  //   setup
  //     .do(async ctx => {
  //       prevStat = await fsPromises.stat(path.join(ctx.dir, 'manifest.json'))
  //     })
  //     .stdout()
  //     .command(['upgrade'])
  //     .it('upgrades a directory', async ctx => {
  //       expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
  //       // upgrade successful if it updates stats of manifest json
  //       expect(await fsPromises.stat('manifest.json')).not.toEqual(prevStat)
  //     })
})
