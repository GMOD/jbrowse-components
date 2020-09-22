/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'
import { setup } from '../testUtil'

const fsPromises = fs.promises

const defaultConfig = {
  assemblies: [],
  configuration: {},
  connections: [],
  defaultSession: {
    name: 'New Session',
  },
  tracks: [],
}

// extend setup to include the addition of a simple HTML index to serve statically
const testIndex = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'simpleIndex.html',
)
const setupWithCreate = setup.do(async ctx => {
  await fsPromises.copyFile(
    testIndex,
    path.join(ctx.dir, path.basename(testIndex)),
  )
})

// make sure if no config written, default gets written

// testing port

// fails w/ wrong or no adminKey

// succesful test: URL is correct

// test by making change to root model (figure out how to change rootModel, or just do POST directly)

// successful test: if correct should match what expected (try w/ out nock first)

// remember to kill server in tests (afterEach)

describe('admin-server', () => {
  setupWithCreate
    .do(async () => {
      await fsPromises.unlink('manifest.json')
    })
    .command(['admin-server'])
    .exit(10)
    .it('fails if no manifest.json found in cwd')
  setupWithCreate
    .command(['admin-server'])
    .it('creates a default config', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents).toEqual(defaultConfig))
    })
})
