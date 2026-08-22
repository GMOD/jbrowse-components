import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// A `declare module '@jbrowse/core/PluginManager'` block only constrains a
// caller whose program already contains the file the block is written in. In
// tree that is invisible — one program holds everything, so every declaration
// is loaded no matter who imported what. An external plugin's program holds
// only what it imports, and for a point declared away from PluginManager.ts
// that is usually nothing: `addToExtensionPoint` then falls to its untyped
// overload and infers the callback's parameter from whatever the callback
// claims. jbrowse-plugin-apollo kept a `Core-extendWorker` callback typed
// against a `{ client, worker }` handle for months that way, and it typechecked
// clean the whole time — the shape was not unchecked, it *was* the check.
//
// PluginManager.ts pulls each declaring module in with a side-effect type
// import so that every plugin — all of them take a PluginManager — gets every
// core-declared point. tsc keeps those in the emitted `.d.ts` as bare
// `import './x.ts'`, which is what carries them to an installed consumer.
//
// They look unused, which is the whole reason for this test: nothing else fails
// when one is deleted, or when a new declaration site lands without one.
const src = path.join(__dirname)

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === 'node_modules' ? [] : walk(full)
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : []
  })
}

function declaresExtensionPoints(file: string) {
  const source = readFileSync(file, 'utf8')
  return (
    source.includes('interface ExtensionPointRegistry') &&
    /declare module ['"](?:@jbrowse\/core\/PluginManager|\.[^'"]*PluginManager\.ts)['"]/.test(
      source,
    )
  )
}

function importedSpecifiers(file: string) {
  return [
    ...readFileSync(file, 'utf8').matchAll(
      /^(?:import|export)[^;]*?from\s+'([^']+)'/gm,
    ),
  ].map(m => m[1]!)
}

test('every core module declaring an extension point is reachable from PluginManager', () => {
  const pluginManager = path.join(src, 'PluginManager.ts')
  const reachable = new Set(
    importedSpecifiers(pluginManager)
      .filter(spec => spec.startsWith('.'))
      .map(spec => path.resolve(src, spec)),
  )

  const missing = walk(src)
    .filter(file => file !== pluginManager)
    .filter(declaresExtensionPoints)
    .filter(file => !reachable.has(file))
    .map(file => path.relative(src, file))

  expect(missing).toEqual([])
})

test('the reachability set is not vacuous', () => {
  const declaring = walk(src).filter(declaresExtensionPoints)
  expect(declaring.length).toBeGreaterThan(1)
})
