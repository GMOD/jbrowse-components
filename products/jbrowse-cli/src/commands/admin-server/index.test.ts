/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'

import fetch from '../../cliFetch.ts'
import { dataDir, readConf, runCommand, runInTmpDir } from '../../testUtil.ts'

const { copyFile, rename, chmod } = fs.promises

const testConfig = dataDir('test_config.json')

// extend setup to include the addition of a simple HTML index to serve statically
const testIndex = dataDir('simpleIndex.html')

function getPort(output: string) {
  const portMatch = /localhost:([0-9]{4})/.exec(output)
  const port = portMatch?.[1]
  if (!port) {
    throw new Error(`Port not found in "${JSON.stringify(output)}"`)
  }
  return port
}

function getAdminKey(output: string) {
  const keyMatch = /Admin key: ([a-zA-Z0-9]{10,})/.exec(output)
  const key = keyMatch?.[1]
  if (!key) {
    throw new Error(`Admin key not found in "${output}"`)
  }
  return key
}

async function killServer({ stdout }: { stdout: string }) {
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
    await killServer({ stdout })
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
    await killServer({ stdout })
  })
})

test('uses port 9090 if not specified', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server'])
    expect(stdout).toMatch(/http:\/\/localhost:9090\?adminKey=[a-zA-Z0-9]{10,}/)
    await killServer({ stdout })
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
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Error: Invalid admin key')
    await killServer({ stdout })
  })
})

test('writes the config to disk if adminKey is valid', async () => {
  await runInTmpDir(async ctx => {
    const { stdout } = await runCommand(['admin-server', '--port', '9094'])
    const adminKey = getAdminKey(stdout)
    const config = { foo: 'bar' }
    const response = await fetch(`http://localhost:9094/updateConfig`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adminKey, config }),
    })

    expect(await response.text()).toBe('Config updated successfully')
    expect(readConf(ctx)).toEqual(config)
    await killServer({ stdout })
  })
})

test('throws an error if unable to write to config.json', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9095'])
    await chmod('config.json', '444')
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
    expect(await response.text()).toMatch(/Failed to update config/)
    await killServer({ stdout })
  })
})
test('throws an error if unable to write to config.json pt 2', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9096'])
    const adminKey = getAdminKey(stdout)
    const configPath = '/etc/passwd'
    const config = { foo: 'bar' }
    const payload = { configPath, adminKey, config }
    const response = await fetch('http://localhost:9096/updateConfig?', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    expect(response.status).toBe(500)
    expect(await response.text()).toMatch(/Failed to update config/)
    await killServer({ stdout })
  })
})

test('blocks relative path traversal attempts in updateConfig', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9097'])
    const adminKey = getAdminKey(stdout)
    const configPath = '../../../etc/passwd'
    const config = { foo: 'bar' }
    const payload = { configPath, adminKey, config }
    const response = await fetch('http://localhost:9097/updateConfig', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    expect(response.status).toBe(401)
    expect(await response.text()).toMatch(/Cannot perform directory traversal/)
    await killServer({ stdout })
  })
})

test('blocks relative path traversal attempts in config route', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9098'])
    const adminKey = getAdminKey(stdout)
    const configPath = '../../../etc/passwd'
    const response = await fetch(
      `http://localhost:9098/config?adminKey=${adminKey}&config=${configPath}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
    expect(response.status).toBe(401)
    expect(await response.text()).toMatch(/Cannot perform directory traversal/)
    await killServer({ stdout })
  })
})

test('allows valid configPath in updateConfig', async () => {
  await runInTmpDir(async ctx => {
    const { stdout } = await runCommand(['admin-server', '--port', '9099'])
    const adminKey = getAdminKey(stdout)
    const configPath = 'custom-config.json'
    const config = { foo: 'custom' }
    const payload = { configPath, adminKey, config }
    const response = await fetch('http://localhost:9099/updateConfig', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Config updated successfully')

    // Verify the file was created in the correct location
    const customConfigPath = path.join(ctx.dir, configPath)
    expect(fs.existsSync(customConfigPath)).toBe(true)

    // Verify the content
    const content = JSON.parse(fs.readFileSync(customConfigPath, 'utf8'))
    expect(content).toEqual(config)

    await killServer({ stdout })
  })
})

// the config payload used to be read before the key was checked, and express 5
// leaves req.body undefined when no JSON body was parsed — so an unauthorized
// request with no body threw a TypeError and got a 500 instead of a 401
test('rejects an unauthorized updateConfig with no body', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9100'])
    const response = await fetch('http://localhost:9100/updateConfig', {
      method: 'POST',
    })
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Error: Invalid admin key')
    await killServer({ stdout })
  })
})

test('rejects an updateConfig with a valid key but no config', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9101'])
    const response = await fetch('http://localhost:9101/updateConfig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey: getAdminKey(stdout) }),
    })
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Error: Missing config in request body')
    await killServer({ stdout })
  })
})

// The static half is why serve-handler is here rather than a hand-rolled file
// server: `jbrowse add-track` puts BAM/CRAM/BigWig next to config.json, and the
// app fetches those by byte range. A 200 with the whole file, or a 206 with the
// wrong slice, is a corrupt read rather than a visible failure.
test('serves a byte range out of a file in the served directory', async () => {
  await runInTmpDir(async ctx => {
    const body = '0123456789abcdefghij'
    fs.writeFileSync(path.join(ctx.dir, 'data.txt'), body)
    const { stdout } = await runCommand(['admin-server', '--port', '9102'])
    const response = await fetch('http://localhost:9102/data.txt', {
      headers: { Range: 'bytes=5-9' },
    })
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 5-9/20')
    expect(await response.text()).toBe('56789')
    await killServer({ stdout })
  })
})

test('serves the whole file when no range is asked for', async () => {
  await runInTmpDir(async ctx => {
    fs.writeFileSync(path.join(ctx.dir, 'data.txt'), 'hello')
    const { stdout } = await runCommand(['admin-server', '--port', '9103'])
    const response = await fetch('http://localhost:9103/data.txt')
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('hello')
    await killServer({ stdout })
  })
})

// `/` is the JBrowse app when the directory holds one and the greeting only
// when it does not — an admin server pointed at a real install has to load the
// app, which is what `express.static` running before the routes used to give
test('/ serves index.html when the directory has one', async () => {
  await runInTmpDir(async ctx => {
    fs.writeFileSync(path.join(ctx.dir, 'index.html'), '<h1>JBrowse</h1>')
    const { stdout } = await runCommand(['admin-server', '--port', '9104'])
    const response = await fetch('http://localhost:9104/')
    expect(await response.text()).toBe('<h1>JBrowse</h1>')
    await killServer({ stdout })
  })
})

test('/ greets when the directory has no index.html', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9105'])
    const response = await fetch('http://localhost:9105/')
    expect(await response.text()).toBe('JBrowse Admin Server')
    await killServer({ stdout })
  })
})

test('a body over the size limit is refused rather than buffered', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand([
      'admin-server',
      '--port',
      '9106',
      '--bodySizeLimit',
      '1kb',
    ])
    const response = await fetch('http://localhost:9106/updateConfig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminKey: getAdminKey(stdout),
        config: { padding: 'x'.repeat(2000) },
      }),
    })
    expect(response.status).toBe(413)
    await killServer({ stdout })
  })
})

test('a malformed JSON body is a 400, not a 500', async () => {
  await runInTmpDir(async () => {
    const { stdout } = await runCommand(['admin-server', '--port', '9107'])
    const response = await fetch('http://localhost:9107/updateConfig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    })
    expect(response.status).toBe(400)
    await killServer({ stdout })
  })
})

test('a bad --bodySizeLimit is reported instead of silently defaulting', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand([
      'admin-server',
      '--port',
      '9108',
      '--bodySizeLimit',
      'twenty megabytes',
    ])
    expect(error?.message).toMatch(/not a valid body size limit/)
  })
})
