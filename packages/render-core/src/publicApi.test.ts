import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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
// symmetric snapshot: additions show up too.
//
// There was a fifth case here, pinning the names re-exported from a `src/index.ts`
// barrel. The barrel is gone (see the package CLAUDE.md): it duplicated 88 of
// its 90 names from the subpath map below, contributed two `useRenderingBackend`
// internals it claimed not to re-export, and had 15 in-repo importers against
// the subpaths' 336. Pinning a second spelling of the same surface only ever
// guaranteed the two spellings were pinned, not that they agreed.
//
// Update with `jest -u` and say in the commit message what moved and why.

interface Manifest {
  exports: Record<string, string>
  publishConfig: {
    exports: Record<string, unknown>
  }
}

const packageRoot = join(__dirname, '..')
const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
) as Manifest

describe('render-core public surface', () => {
  it('pins the subpath exports', () => {
    expect(Object.keys(manifest.exports).sort()).toMatchSnapshot()
  })

  // See display-kit's copy: a condition object can only narrow who gets an
  // answer, and there is one ESM file per subpath to narrow between.
  it('maps each subpath to a bare string, not a condition object', () => {
    expect(
      Object.entries(manifest.publishConfig.exports).filter(
        ([, target]) => typeof target !== 'string',
      ),
    ).toEqual([])
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
  })

  it('carries no typesVersions', () => {
    // It answered only `moduleResolution: "node"`, which reads no `exports` map
    // at all. The plugins still on that setting cap `@jbrowse/core` below this
    // major, so the field resolved types for nobody who could install the
    // package — and TS 7 removes `node10` regardless.
    expect(manifest.publishConfig).not.toHaveProperty('typesVersions')
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
