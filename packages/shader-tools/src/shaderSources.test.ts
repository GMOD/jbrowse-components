// Every shader with entry points hands out its text through `SOURCE` and
// nowhere else, and every loader there resolves to its target's text.
//
// A loader that resolves to the wrong module fails at HAL creation, where the
// ladder reads it as "this rung is unavailable" and draws on the next one: the
// display lands on Canvas2D with a console warning and nothing says why.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  parseTargets,
  stripComments,
} from './shader-codegen/parseDirectives.ts'

const root = path.resolve(__dirname, '../../..')

const TEXT_EXPORTS = {
  wgsl: ['WGSL_SOURCE'],
  glsl: ['GLSL_FRAGMENT', 'GLSL_VERTEX'],
}

const shaders = execFileSync('git', ['ls-files', '*.slang'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter(
    file =>
      file &&
      stripComments(readFileSync(path.join(root, file), 'utf8')).includes(
        '[shader(',
      ),
  )

test('finds the tree’s shaders', () => {
  expect(shaders.length).toBeGreaterThan(40)
})

test.each(shaders)('%s loads its text through SOURCE alone', async file => {
  const targets = parseTargets(readFileSync(path.join(root, file), 'utf8'))
  const mod: Record<string, unknown> & {
    SOURCE: Partial<Record<'wgsl' | 'glsl', () => Promise<object>>>
  } = await import(path.join(root, file.replace(/\.slang$/, '.generated.ts')))
  expect(Object.keys(mod).filter(k => /^(WGSL|GLSL)_/.test(k))).toEqual([])
  expect(Object.keys(mod.SOURCE).sort()).toEqual([...targets].sort())
  for (const target of targets) {
    const text: Record<string, unknown> = { ...(await mod.SOURCE[target]?.()) }
    expect(Object.keys(text).sort()).toEqual(TEXT_EXPORTS[target])
    for (const value of Object.values(text)) {
      expect(typeof value === 'string' && value.length > 0).toBe(true)
    }
  }
})
