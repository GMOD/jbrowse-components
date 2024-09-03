/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'
import { runCommand } from '@oclif/test'

// locals
import fetch from '../fetchWithProxy'
import { dataDir, readConf, runInTmpDir } from '../testUtil'

const { copyFile, rename, chmod } = fs.promises

const testConfig = dataDir('test_config.json')

// extend setup to include the addition of a simple HTML index to serve statically
const testIndex = dataDir('simpleIndex.html')

// Cleaning up exitCode in Node.js 20, xref
// https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

function getPort(output: string) {
  const portMatch = /localhost:([0-9]{4})/.exec(output)
  const port = portMatch?.[1]
  if (!port) {
    throw new Error(`Port not found in "${JSON.stringify(output)}"`)
  }
  return port
}

function getAdminKey(output: string) {
  const keyMatch = /adminKey=([a-zA-Z0-9]{10,12}) /.exec(output)
  const key = keyMatch?.[1]
  if (!key) {
    throw new Error(`Admin key not found in "${output}"`)
  }
  return key
}

async function killExpress({ stdout }: { stdout: string }) {
  // if (!stdout || typeof stdout !== 'string') {
  //   // This test didn't start a server
  //   return
  // }
  return fetch(`http://localhost:${getPort(stdout)}/shutdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey: getAdminKey(stdout) }),
  })
}

test('creates a default config', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(testIndex, path.join(ctx.dir, path.basename(testIndex)))
    const { stdout } = await runCommand(['admin-server', '--port', '9091'])
    expect(readConf(ctx)).toMatchSnapshot()
    await killExpress({ stdout })
  })
})

test('does not overwrite an existing config', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

    await rename(
      path.join(ctx.dir, path.basename(testConfig)),
      path.join(ctx.dir, 'config.json'),
    )

    const { stdout } = await runCommand(['admin-server', '--port', '9092'])

    expect(readConf(ctx)).toMatchSnapshot()
    await killExpress({ stdout })
  })
})

test('uses port 9090 if not specified', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server'])
    expect(stdout).toMatch(
      /http:\/\/localhost:9090\?adminKey=[a-zA-Z0-9]{10,12}/,
    )
    await killExpress({ stdout })
  })
})

test('throws an error with a negative port', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['admin-server', '--port', '-10'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('throws an error with a port greater than 65535', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['admin-server', '--port', '66666'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('notifies the user if adminKey is incorrect', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9093'])
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
    await killExpress({ stdout })
  })
})

test('writes the config to disk if adminKey is valid', async () => {
  await runInTmpDir(async ctx => {
    const { stdout } = await runCommand(['admin-server', '--port', '9094'])
    const adminKey = getAdminKey(stdout)
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
    await killExpress({ stdout })
  })
})

test('throws an error if unable to write to config.json', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9095'])
    await chmod('config.json', '444')
    // grab the correct admin key from URL
    const adminKey = getAdminKey(stdout)
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
    await killExpress({ stdout })
  })
})
test('throws an error if unable to write to config.json pt 2', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9096'])
    const adminKey = getAdminKey(stdout)
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
    expect(await response.text()).toMatch(/Cannot perform directory traversal/)
    await killExpress({ stdout })
  })
})
