import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const src = path.dirname(fileURLToPath(import.meta.url))

function run(...args) {
  return spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--import',
      path.join(src, 'integrationRegister.mjs'),
      path.join(src, 'main.ts'),
      ...args,
    ],
    { encoding: 'utf8' },
  )
}

test('list -v prints the version rather than listing a genome named -v', () => {
  const { status, stdout } = run('list', '-v')
  assert.equal(status, 0)
  assert.match(stdout, /^\d+\.\d+\.\d+/)
})

test('a bad flag value fails the run with one line naming the flag', () => {
  const { status, stderr } = run('--width', '12O', '--loc', 'chr1')
  assert.equal(status, 1)
  assert.equal(stderr.trim(), 'jb2export: --width needs a number, got "12O"')
})

test('-o is --out, and an extension jb2export cannot write fails before rendering', () => {
  const { status, stderr } = run('--loc', 'chr1', '-o', 'out.jpg')
  assert.equal(status, 1)
  assert.match(stderr, /^jb2export: --out needs a \.svg, \.png or \.pdf path/)
})

test('two flags cannot both read stdin', () => {
  const { status, stderr } = run('--config', '-', '--spec', '-')
  assert.equal(status, 1)
  assert.match(stderr, /--config and --spec cannot both read stdin/)
})
