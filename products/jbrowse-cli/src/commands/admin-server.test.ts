/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
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

const testConfig = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'test_config.json',
)

const testConfigContents = {
  assemblies: [
    {
      name: 'testAssembly',
      sequence: {
        type: 'testSequenceTrack',
        trackId: '',
        adapter: {
          type: 'testSeqAdapter',
          twoBitLocation: {
            uri: 'test.2bit',
          },
        },
      },
    },
  ],
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

async function killExpress(ctx: { stdoutWrite: jest.Mock }, port: number) {
  const adminKey = ctx.stdoutWrite.mock.calls[0][0].match(
    /adminKey=([a-zA-Z0-9]{10,12}) /,
  )[1]
  const payload = { adminKey }
  await fetch(`http://localhost:${port}/shutdown`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

describe('admin-server', () => {
  setupWithCreate
    .command(['admin-server', '--port', '9091'])
    .finally(async ctx => {
      await killExpress(ctx, 9091)
    })
    .it('creates a default config', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual(defaultConfig)
    })
  setupWithCreate
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['admin-server', '--port', '9092'])
    .finally(async ctx => {
      await killExpress(ctx, 9092)
    })
    .it('does not overwrite an existing config', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual(testConfigContents)
    })
  setupWithCreate
    .command(['admin-server'])
    .finally(async ctx => {
      await killExpress(ctx, 9090)
    })
    .it('uses port 9090 if not specified', async ctx => {
      expect(ctx.stdoutWrite.mock.calls[0][0]).toMatch(
        /http:\/\/localhost:9090\?adminKey=[a-zA-Z0-9]{10,12}/,
      )
    })
  setupWithCreate
    .command(['admin-server', '--port', '-10'])
    .catch('-10 is not a valid port')
    .it('throws an error with a negative port')
  setupWithCreate
    .command(['admin-server', '--port', '66666'])
    .catch('66666 is not a valid port')
    .it('throws an error with a port greater than 65535')
  setupWithCreate
    .command(['admin-server', '--port', '9093'])
    .finally(async ctx => {
      await killExpress(ctx, 9093)
    })
    .it('notifies the user if adminKey is incorrect', async () => {
      const payload = { adminKey: 'badKey' }
      const response = await fetch('http://localhost:9093/updateConfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      expect(response.status).toBe(403)
      expect(await response.text()).toBe('Admin key does not match')
    })
  setupWithCreate
    .command(['admin-server', '--port', '9094'])
    .finally(async ctx => {
      await killExpress(ctx, 9094)
    })
    .it('writes the config to disk if adminKey is valid', async ctx => {
      // grab the correct admin key from URL
      const adminKey = ctx.stdoutWrite.mock.calls[0][0].match(
        /adminKey=([a-zA-Z0-9]{10,12}) /,
      )[1]
      const config = { foo: 'bar' }
      const payload = { adminKey, config }
      const response = await fetch('http://localhost:9094/updateConfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(await response.text()).toBe('Config written to disk')
      expect(JSON.parse(contents)).toEqual(config)
    })
  setupWithCreate
    .command(['admin-server', '--port', '9095'])
    .do(async () => {
      await fsPromises.chmod('config.json', '444')
    })
    .finally(async ctx => {
      await killExpress(ctx, 9095)
    })
    .it('throws an error if unable to write to config.json', async ctx => {
      const adminKey = ctx.stdoutWrite.mock.calls[0][0].match(
        /adminKey=([a-zA-Z0-9]{10,12}) /,
      )[1]
      const config = { foo: 'bar' }
      const payload = { adminKey, config }
      const response = await fetch('http://localhost:9095/updateConfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      expect(response.status).toBe(500)
      expect(await response.text()).toMatch(/Could not write config file/)
    })

  setupWithCreate
    .command(['admin-server', '--port', '9096'])
    .finally(async ctx => {
      await killExpress(ctx, 9096)
    })
    .it('throws an error if unable to write to config.json', async ctx => {
      const adminKey = ctx.stdoutWrite.mock.calls[0][0].match(
        /adminKey=([a-zA-Z0-9]{10,12}) /,
      )[1]
      const configPath = '/etc/passwd'
      const config = { foo: 'bar' }
      const payload = { configPath, adminKey, config }
      const response = await fetch('http://localhost:9096/updateConfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      expect(response.status).toBe(500)
      expect(await response.text()).toMatch(
        /Cannot perform directory traversal/,
      )
    })
})
