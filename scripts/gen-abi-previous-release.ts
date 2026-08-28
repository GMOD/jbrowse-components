// Regenerates packages/core/src/ReExports/abiPreviousRelease.json from the
// @jbrowse/core build we actually published last, so check-published-plugins.ts
// can check the current ABI against what plugins in the wild were built against.
//
// Run at release time, after the version bump lands:
//
//   node --experimental-strip-types scripts/gen-abi-previous-release.ts 4.3.0
//
// It downloads the published tarball rather than reading the git tag: the tag
// carries source, and what a plugin links against is the emitted package. The
// .d.ts tree is the closest offline description of that -- tsc has already
// resolved the `export *` chains that the source spreads over ~40 barrels.
//
// Two surfaces come out of the same tarball. `modules` is the `jbrequire`
// re-export registry, name by name. `subpaths` is the published `exports` map,
// which is what a plugin deep-importing `@jbrowse/core/util/QuickLRU` resolves
// against -- a separate promise, generated in this repo from in-repo import
// sites, so it can lose an entry with nobody deciding to drop it.
//
// Type-only exports are dropped, because a plugin importing one gets nothing at
// runtime and so can't be broken by its removal.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import reExportsList from '../packages/core/src/ReExports/list.ts'

const OUT = 'packages/core/src/ReExports/abiPreviousRelease.json'

// Module path -> the .d.ts that describes it, mirroring the `libs` map in
// modules.ts. Only the modules whose runtime value is a namespace of the
// barrel's own exports are listed; see SHAPE_MISMATCH below for the rest.
const MODULE_ENTRY: Record<string, string> = {
  '@jbrowse/core/configuration': 'configuration/index.d.ts',
  '@jbrowse/core/data_adapters/BaseAdapter':
    'data_adapters/BaseAdapter/index.d.ts',
  '@jbrowse/core/pluggableElementTypes': 'pluggableElementTypes/index.d.ts',
  '@jbrowse/core/pluggableElementTypes/models':
    'pluggableElementTypes/models/index.d.ts',
  '@jbrowse/core/ui': 'ui/index.d.ts',
  '@jbrowse/core/ui/palette': 'ui/palette.d.ts',
  '@jbrowse/core/ui/theme': 'ui/theme.d.ts',
  '@jbrowse/core/util': 'util/index.d.ts',
  '@jbrowse/core/util/color': 'util/color/index.d.ts',
  '@jbrowse/core/util/io': 'util/io/index.d.ts',
  '@jbrowse/core/util/layouts': 'util/layouts/index.d.ts',
  '@jbrowse/core/util/mst-reflection': 'util/mst-reflection.d.ts',
  '@jbrowse/core/util/rxjs': 'util/rxjs.d.ts',
  '@jbrowse/core/util/tracks': 'util/tracks.d.ts',
  '@jbrowse/core/util/types/mst': 'util/types/mst.d.ts',
}

// Modules served as something other than a namespace of their barrel, so the
// .d.ts export names are not the runtime keys and comparing them reports
// removals that never happened:
//
//   Plugin, AdapterType, DisplayType, TrackType, ViewType, WidgetType
//     served as the class itself, so the only runtime key is whatever the
//     bundler reads for a default import.
//   util/Base1DViewModel
//     served as an MST type, whose keys are MST internals (`properties`,
//     `preProcessSnapshot`, ...) rather than exports.
//   BaseFeatureWidget/BaseFeatureDetail
//     served as lazyMap(..., '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/'),
//     so its keys are fully-prefixed module paths, not bare component names.
//
// These are still checked for module-path presence, just not name by name.
const SHAPE_MISMATCH = reExportsList
  .filter(m => m.startsWith('@jbrowse/core/'))
  .filter(m => !(m in MODULE_ENTRY))

function resolveSpec(spec: string, from: string, root: string) {
  if (!spec.startsWith('.')) {
    return undefined
  }
  const base = path.normalize(path.join(path.dirname(from), spec))
  const candidates = [
    base,
    base.replace(/\.ts$/, '.d.ts'),
    `${base}.d.ts`,
    path.join(base, 'index.d.ts'),
  ]
  return candidates.find(c => fs.existsSync(path.join(root, c)))
}

// Collect the runtime (value) exports of a .d.ts, following `export * from`.
function valueExports(entry: string, root: string, seen = new Set<string>()) {
  if (seen.has(entry)) {
    return new Set<string>()
  }
  seen.add(entry)
  const src = fs.readFileSync(path.join(root, entry), 'utf8')
  const names = new Set<string>()

  // `export { a, b as c }` and `export { a } from './x'`, skipping `export type {`
  for (const m of src.matchAll(
    /export\s+(type\s+)?\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/g,
  )) {
    if (m[1]) {
      continue
    }
    for (const raw of m[2]!.split(',')) {
      const part = raw.trim()
      if (!part || part.startsWith('type ')) {
        continue
      }
      names.add(
        (part.includes(' as ') ? part.split(' as ').pop()! : part).trim(),
      )
    }
  }
  for (const m of src.matchAll(
    /export\s+declare\s+(?:async\s+)?(?:abstract\s+class|class|const|function|let|var|enum)\s+([A-Za-z0-9_$]+)/g,
  )) {
    names.add(m[1]!)
  }
  for (const m of src.matchAll(/export\s+\*\s+from\s*['"]([^'"]+)['"]/g)) {
    const target = resolveSpec(m[1]!, entry, root)
    if (target) {
      for (const n of valueExports(target, root, seen)) {
        names.add(n)
      }
    }
  }
  return names
}

const version = process.argv[2]
if (!version) {
  throw new Error('usage: gen-abi-previous-release.ts <version>')
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-abi-'))
const tarball = execFileSync(
  'npm',
  ['pack', `@jbrowse/core@${version}`, '--silent'],
  {
    cwd: tmp,
    encoding: 'utf8',
  },
).trim()
execFileSync('tar', ['xzf', tarball], { cwd: tmp })
const root = path.join(tmp, 'package', 'esm')

// The published `exports` map, whose keys are the deep-import subpaths an
// external plugin can resolve. npm swaps `publishConfig.exports` in at publish
// time, so this is the emitted map and not the workspace one.
const subpaths = Object.keys(
  (
    JSON.parse(
      fs.readFileSync(path.join(tmp, 'package', 'package.json'), 'utf8'),
    ) as { exports?: Record<string, unknown> }
  ).exports ?? {},
).sort()

const modules: Record<string, string[]> = {}
const addedSince: string[] = []
for (const [name, entry] of Object.entries(MODULE_ENTRY)) {
  // A module the previous release didn't serve (@jbrowse/core/ui/palette is new
  // in v5) has nothing to check -- growing the ABI is always safe.
  if (fs.existsSync(path.join(root, entry))) {
    modules[name] = [...valueExports(entry, root)].sort()
  } else {
    addedSince.push(name)
  }
}

fs.writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      version,
      addedSinceModules: addedSince.sort(),
      shapeMismatchModules: SHAPE_MISMATCH.sort(),
      subpaths,
      modules,
    },
    null,
    2,
  )}\n`,
)
fs.rmSync(tmp, { recursive: true, force: true })
// JSON.stringify's array wrapping is not oxfmt's, and the Format job checks
// every file, so a regeneration would otherwise land red.
execFileSync('npx', ['oxfmt', OUT], { stdio: 'inherit' })

const total = Object.values(modules).reduce((a, b) => a + b.length, 0)
console.log(
  `wrote ${OUT}: @jbrowse/core@${version}, ${total} names in ${Object.keys(modules).length} modules, ${subpaths.length} subpaths`,
)
