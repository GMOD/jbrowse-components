import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http2 from 'node:http2'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import zlib from 'node:zlib'

const { setupEnv } = await import('../src/index.ts')
setupEnv()

function selfSignedCert() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-h2-'))
  const key = path.join(dir, 'key.pem')
  const cert = path.join(dir, 'cert.pem')
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-subj',
      '/CN=localhost',
      '-days',
      '1',
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'ignore' },
  )
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) }
}

test('a brotli-encoded HTTP/2 response is decoded after setupEnv', async t => {
  const body = { assemblies: [{ name: 'volvox' }] }
  const server = http2.createSecureServer(selfSignedCert(), (_req, res) => {
    res.writeHead(200, {
      'content-type': 'application/json',
      'content-encoding': 'br',
    })
    res.end(zlib.brotliCompressSync(JSON.stringify(body)))
  })
  await new Promise(resolve => server.listen(0, resolve))
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  t.after(() => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous
    server.close()
  })
  const res = await fetch(`https://localhost:${server.address().port}/`)
  assert.equal(res.headers.get('content-encoding'), 'br')
  assert.deepEqual(await res.json(), body)
})
