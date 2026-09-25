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
  resolveTextureFilter,
  stripComments,
} from './shader-codegen/parseDirectives.ts'
import { readImports } from './shader-codegen/readImports.ts'

// Structural, because shader-tools must not depend on render-core — the same
// arrangement `bindings.ts` already names for `ShaderBinding`.
interface Sampler {
  filter: string
}

const root = path.resolve(__dirname, '../../..')
const sharedInclude = path.join(root, 'packages/render-core/src/shaders')

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

// Against the shader's own declaration rather than a list kept here: a
// regenerate after a codegen regression is the case a fixed expectation would
// wave through.
test.each(shaders)('%s samples with the filter it declares', async file => {
  const slangPath = path.join(root, file)
  const source = readFileSync(slangPath, 'utf8')
  const mod: { TEXTURES?: readonly Sampler[] } = await import(
    path.join(root, file.replace(/\.slang$/, '.iface.generated.ts'))
  )
  const declared = resolveTextureFilter(
    file,
    source,
    readImports(slangPath, source, sharedInclude),
  )
  expect(mod.TEXTURES?.map(t => t.filter)).toEqual(
    mod.TEXTURES?.map(() => declared),
  )
})

// The case above is vacuous for a shader with no sampler, which is most of
// them, so the one carrying the hazard is named.
test('spanMark inherits nearest from the module that demands it', async () => {
  const file = 'packages/render-core/src/shaders/spanMark.slang'
  const source = readFileSync(path.join(root, file), 'utf8')
  expect(/^\/\/!\s*texture-filter:/m.test(source)).toBe(false)
  const mod: { TEXTURES: readonly Sampler[] } = await import(
    path.join(
      root,
      'packages/render-core/src/shaders/spanMark.iface.generated.ts',
    )
  )
  expect(mod.TEXTURES.map(t => t.filter)).toEqual(['nearest'])
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
