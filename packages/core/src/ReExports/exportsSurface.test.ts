import { readFileSync } from 'node:fs'
import path from 'node:path'

import reExportsList from './list.ts'

// Two different files answer "what may an external plugin import from
// @jbrowse/core", and they are maintained by opposite methods.
//
// `package.json` `exports` is *generated* -- scripts/generateExports.mjs scans
// the repo for subpath imports and publishes what it finds, plus a hand-kept
// `preservedExports` list. So the plugin-visible module surface is a side effect
// of how in-repo code happens to spell its own imports.
//
// `ReExports/list.ts` is the runtime ABI: the paths a plugin build externalizes
// and the host resolves out of JBrowseExports. It is hand-written.
//
// A path has to be in both to be usable. `exports` alone and the host does not
// serve it, so importing it silently vendors a private copy of core into the
// plugin bundle, which then drifts from the host -- that is a size and skew
// problem, not a crash, and it is why react-msaview carried 33 KB of
// @jbrowse/core inside jbrowse-plugin-msaview. `list.ts` alone is worse and is
// what this test exists for: the host serves the module and nothing can import
// it, because resolution fails at the plugin's own build. That is how
// '@jbrowse/core/util/mst-reflection' sat in the ABI, in modules.ts and in
// abiBaseline.json while being unreachable -- sharedModules.ts is its only
// reader and reaches it by relative path, so the scan never saw it.
const pkg = JSON.parse(
  readFileSync(path.join(__dirname, '../../package.json'), 'utf8'),
) as { exports: Record<string, unknown> }

test('every module the runtime ABI serves is importable from the package', () => {
  const exported = new Set(Object.keys(pkg.exports))
  const missing = reExportsList
    .filter(name => name.startsWith('@jbrowse/core/'))
    .filter(name => !exported.has(`.${name.slice('@jbrowse/core'.length)}`))
  // the fix is an entry in generateExports.mjs's `preservedExports`, then
  // `node scripts/generateExports.mjs` from packages/core
  expect(missing).toEqual([])
})
