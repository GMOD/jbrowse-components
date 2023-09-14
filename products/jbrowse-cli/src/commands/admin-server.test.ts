/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

// locals
import fetch from '../fetchWithProxy'
import { setup, dataDir, readConf } from '../testUtil'

const { copyFile, rename, chmod } = fs.promises

const defaultConfig = {
  assemblies: [],
  configuration: {},
  connections: [],
  defaultSession: {
    name: 'New Session',
  },
  tracks: [],
}

const testConfig = dataDir('test_config.json')

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
            locationType: 'UriLocation',
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
const testIndex = dataDir('simpleIndex.html')

const setupWithCreateAndTeardown = setup
  .do(ctx => copyFile(testIndex, path.join(ctx.dir, path.basename(testIndex))))
  .finally(killExpress)

function getPort(output: string) {
  const portMatch = output.match(/localhost:([0-9]{4})/)
  const port = portMatch?.[1]
  if (!port) {
    throw new Error(`Port not found in "${JSON.stringify(output)}"`)
  }
  return port
}

function getAdminKey(output: string) {
  const keyMatch = output.match(/adminKey=([a-zA-Z0-9]{10,12}) /)
  const key = keyMatch?.[1]
  if (!key) {
    throw new Error(`Admin key not found in "${output}"`)
  }
  return key
}

async function killExpress({ stdout }: { stdout: string }) {
  if (!stdout || typeof stdout !== 'string') {
    // This test didn't start a server
    return
  }
  return fetch(`http://localhost:${getPort(stdout)}/shutdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey: getAdminKey(stdout) }),
  })
}

// Cleaning up exitCode in Node.js 20, xref https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

describe('admin-server', () => {
  setupWithCreateAndTeardown
    .command(['admin-server', '--port', '9091'])
    .it('creates a default config', async ctx => {
      expect(readConf(ctx)).toEqual(defaultConfig)
    })
  setupWithCreateAndTeardown
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['admin-server', '--port', '9092'])
    .it('does not overwrite an existing config', async ctx => {
      expect(readConf(ctx)).toEqual(testConfigContents)
    })
  setupWithCreateAndTeardown
    .command(['admin-server'])
    .it('uses port 9090 if not specified', async ctx => {
      expect(ctx.stdout).toMatch(
        /http:\/\/localhost:9090\?adminKey=[a-zA-Z0-9]{10,12}/,
      )
    })
  setupWithCreateAndTeardown
    .command(['admin-server', '--port', '-10'])
    .catch('-10 is not a valid port')
    .it('throws an error with a negative port')
  setupWithCreateAndTeardown
    .command(['admin-server', '--port', '66666'])
    .catch('66666 is not a valid port')
    .it('throws an error with a port greater than 65535')
  setupWithCreateAndTeardown
    .command(['admin-server', '--port', '9093'])
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
  setupWithCreateAndTeardown
    .command(['admin-server', '--port', '9094'])
    .it('writes the config to disk if adminKey is valid', async ctx => {
      // grab the correct admin key from URL
      const adminKey = getAdminKey(ctx.stdout)
      const config = { foo: 'bar' }
      const payload = { adminKey, config }
      const response = await fetch('http://localhost:9094/updateConfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      expect(await response.text()).toBe('Config written to disk')
      expect(readConf(ctx)).toEqual(config)
    })
  setupWithCreateAndTeardown
    .command(['admin-server', '--port', '9095'])
    .do(async () => {
      await chmod('config.json', '444')
    })
    .it('throws an error if unable to write to config.json', async ctx => {
      const adminKey = getAdminKey(ctx.stdout)
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

  setupWithCreateAndTeardown
    .command(['admin-server', '--port', '9096'])
    .it('throws an error if unable to write to config.json', async ctx => {
      const adminKey = getAdminKey(ctx.stdout)
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
