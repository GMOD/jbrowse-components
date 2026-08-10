import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import * as barrel from './index.ts'

// ADR-030 makes this package's `exports` map the public API contract, decoupled
// from file layout, and marks the surface `@experimental` until it is frozen
// under semver. The follow-up it named — "add an export-surface guard test in
// render-core" — is this file.
//
// It is deliberately not the `@jbrowse/core` ABI doctrine next door
// (ReExports/abi.test.ts, where removals fail and additions pass silently).
// That asymmetry exists because a runtime re-export binds an already-published
// plugin bundle to the host's live copy, so a removal is an `undefined is not a
// function` in a build nobody will make again. render-core is static-import
// only: a consumer pins a version and rebuilds on its own schedule, so a
// removal breaks a *compile*, not a deployment. What is worth guarding here is
// different — that the surface only changes when someone means it to. Hence a
// symmetric snapshot: additions show up too, which is the point for a package
// whose whole claim is a small curated barrel.
//
// Update with `jest -u` and say in the commit message what moved and why.

interface Manifest {
  exports: Record<string, string>
  publishConfig: {
    exports: Record<string, { types: string; import: string }>
    typesVersions: Record<string, Record<string, string[]>>
  }
}

const packageRoot = join(__dirname, '..')
const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
) as Manifest

describe('render-core public surface', () => {
  it('pins the barrel exports', () => {
    // Runtime names only — a type-only export has no key here. That is the
    // right line for this guard: a removed type is a compile error in the
    // consumer's own build, a removed value is one too, but only the value can
    // also be a silent `undefined` if someone reaches for it dynamically.
    expect(Object.keys(barrel).sort()).toMatchSnapshot()
  })

  it('pins the subpath exports', () => {
    expect(Object.keys(manifest.exports).sort()).toMatchSnapshot()
  })

  it('serves no wildcard subpath', () => {
    // The regression this exists for: publishConfig used to end in `"./*"`, so
    // the tarball resolved every emitted file — `webgpuUtils`,
    // `useEventCallback`, all of `hal/*` — while the workspace map refused
    // them. A wildcard means there is no contract to pin, in the one copy that
    // external consumers actually install.
    const wildcards = [
      ...Object.keys(manifest.exports),
      ...Object.keys(manifest.publishConfig.exports),
    ].filter(subpath => subpath.includes('*'))
    expect(wildcards).toEqual([])
  })

  it('publishes exactly the subpaths the workspace declares', () => {
    // scripts/generate-publish-exports.ts derives one from the other, so this
    // only fires on a hand-edit — which is precisely when nothing else would
    // notice until someone unpacked the tarball.
    expect(Object.keys(manifest.publishConfig.exports).sort()).toEqual(
      Object.keys(manifest.exports).sort(),
    )
    expect(
      Object.keys(manifest.publishConfig.typesVersions['*']!).sort(),
    ).toEqual(
      Object.keys(manifest.exports)
        .filter(subpath => subpath !== '.')
        .map(subpath => subpath.slice(2))
        .sort(),
    )
  })

  it('every declared subpath resolves to a source file', () => {
    const missing = Object.entries(manifest.exports).filter(
      ([, srcPath]) => !existsInPackage(srcPath),
    )
    expect(missing).toEqual([])
  })
})

function existsInPackage(relPath: string) {
  try {
    readFileSync(join(packageRoot, relPath))
    return true
  } catch {
    return false
  }
}
