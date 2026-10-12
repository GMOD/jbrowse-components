import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const src = path.dirname(fileURLToPath(import.meta.url))

function run(stubFetch, ...args) {
  return spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--import',
      path.join(src, 'integrationRegister.mjs'),
      ...(stubFetch
        ? [
            '--import',
            'data:text/javascript,globalThis.fetch=()=>new Promise(()=>{})',
          ]
        : []),
      path.join(src, 'main.ts'),
      ...args,
    ],
    { encoding: 'utf8' },
  )
}

test('a run whose promise never settles exits non-zero and says so', () => {
  const { status, stderr } = run(true, 'list')
  assert.equal(status, 1)
  assert.match(stderr, /did not finish/)
})

test('a finished run exits 0 without the message', () => {
  const { status, stdout, stderr } = run(false, '--version')
  assert.equal(status, 0)
  assert.match(stdout, /^\d+\.\d+\.\d+/)
  assert.doesNotMatch(stderr, /did not finish/)
})
