/**
 * @jest-environment node
 *
 * corePlugins pulls every plugin's models, adapters and config schemas — the
 * renderer's whole plugin graph. The app entry must not reach it statically, or
 * the graph is parsed and evaluated before the start screen can draw a pixel.
 *
 * That is held by nothing but the absence of one `import` line, and an app that
 * grew one still works — it just starts slower, which no test would otherwise
 * notice. So this walks the static import graph, in the same spirit as core's
 * menuItems purity test.
 *
 * Note what is deliberately NOT asserted: that the start screen's own plugin
 * manager avoids corePlugins too. Splitting it out to achieve that was tried and
 * reverted — it moved enough between webpack chunks to break the RPC worker in
 * the packaged app (assembly stuck at initialized:false, no error), while
 * leaving main.js the same size. See the note in pluginManagers.tsx.
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../..')
const CORE_PLUGINS = path.join(SRC, 'corePlugins.ts')

// Static, value-level, first-party edges only. `import type` is erased, and a
// dynamic import() is the whole point of the split — neither is an edge that
// costs anything at load time.
function staticImports(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8')
  return [
    ...source.matchAll(
      /^(?:import|export)\s+(?!type\b)[^\n]*?['"](\.[^'"]*)['"]/gm,
    ),
  ]
    .map(m => path.resolve(path.dirname(file), m[1]!))
    .filter(resolved => fs.existsSync(resolved))
}

function reaches(entry: string, target: string) {
  const seen = new Set<string>()
  const queue = [entry]
  const trail = new Map<string, string>()
  while (queue.length) {
    const file = queue.shift()!
    if (file === target) {
      // rebuild the path, so a failure names the import that did it
      const chain = [file]
      let at = file
      while (trail.has(at)) {
        at = trail.get(at)!
        chain.unshift(at)
      }
      return chain.map(f => path.relative(SRC, f))
    }
    if (!seen.has(file)) {
      seen.add(file)
      for (const next of staticImports(file)) {
        if (!seen.has(next)) {
          trail.set(next, file)
          queue.push(next)
        }
      }
    }
  }
  return undefined
}

test('the walker finds a path that does exist', () => {
  // rpcWorker.ts is a separate bundle entry and imports corePlugins outright, so
  // it doubles as proof that an empty result above means "no path", not "the
  // regex matched nothing"
  expect(reaches(path.join(SRC, 'rpcWorker.ts'), CORE_PLUGINS)).toBeDefined()
})

test('the app entry does not reach corePlugins', () => {
  expect(reaches(path.join(SRC, 'index.tsx'), CORE_PLUGINS)).toBeUndefined()
})
