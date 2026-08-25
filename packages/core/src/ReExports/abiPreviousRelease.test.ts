import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import previous from './abiPreviousRelease.json'
import { KNOWN_REMOVALS, KNOWN_SUBPATH_REMOVALS } from './knownRemovals.ts'
import libs from './modules.ts'

// abi.test.ts pins the ABI going forward: its baseline was snapshotted from this
// branch, so it catches the *next* removal. It cannot catch the ones that
// already happened, because the names were gone before the baseline recorded
// them -- and those are the ones sitting in published UMDs right now.
//
// This checks the other direction. abiPreviousRelease.json is the export list of
// the @jbrowse/core we last published, so every name in it is one some plugin
// out there may have been built against. A name no longer in `libs` becomes
// `undefined` inside a bundle nobody is going to rebuild, which is how dropping
// `defaultCodonTable` error-paged published protein3d and msaview.
//
// Regenerate at release time, after the version bump lands:
//   node --experimental-strip-types scripts/gen-abi-previous-release.ts <version>
//
// The removals themselves live in `knownRemovals.ts`, grouped, because the
// announcement and PLUGIN_ABI_STABILITY.md both publish those groups and
// `generate-abi-removals` renders them from there.
//
// What this list costs in the wild is a separate question, and the answer moves
// as plugins are rebuilt, so no count is restated here -- one written down in
// 2026-08 already read "6 of 17" against a live run of 1 of 14. Run
//   node --experimental-strip-types scripts/check-published-plugins.ts
// which reads every bundle in the store and reports only the names each one
// actually takes off JBrowseExports. They declare `jbrowseRange: "*"`, so the
// store offers them to a v5 user as compatible -- pinning that range is the
// other half, and it lives in the separate GMOD/jbrowse-plugin-list repo.

describe('ABI against the previously published release', () => {
  it(`serves every module @jbrowse/core@${previous.version} served`, () => {
    const missing = Object.keys(previous.modules).filter(m => !(m in libs))
    expect(missing).toEqual([])
  })

  it.each(Object.entries(previous.modules))(
    '%s keeps the names it published, or declares the removal',
    (name, names) => {
      const mod = libs[name as keyof typeof libs] as Record<string, unknown>
      const undeclared = names.filter(
        n => !(n in mod) && !(`${name}#${n}` in KNOWN_REMOVALS),
      )
      expect(undeclared).toEqual([])
    },
  )

  it('has no stale KNOWN_REMOVALS entries', () => {
    const modules = previous.modules as Record<string, string[]>
    const stale = Object.keys(KNOWN_REMOVALS).filter(key => {
      // defaults rather than `!`: `exportName! in mod` reads as
      // `!(exportName in mod)`, which is the opposite of what it does
      const [name = '', exportName = ''] = key.split('#')
      const mod = libs[name as keyof typeof libs] as
        | Record<string, unknown>
        | undefined
      // stale two ways: the name came back, or the previous release never had it
      return (mod && exportName in mod) || !modules[name]?.includes(exportName)
    })
    expect(stale).toEqual([])
  })
})

// The `exports` map is a second promise out of the same release, and a quieter
// one: `packages/core/scripts/generateExports.mjs` derives it by grepping the
// repo for import specifiers under `@jbrowse/core`, so deleting the last
// in-repo importer of a subpath drops it from the published map and nothing
// fails. Four modules have already left that way while their source stayed put.
//
// Removals only, so adding an import never asks for anything. When this goes
// red the two answers are `preservedExports` in `generateExports.mjs`, which
// keeps a subpath published with no importer, or `SUBPATH_REMOVALS` in
// `knownRemovals.ts`, which is where meaning it gets written down.
describe('the published exports map against that release', () => {
  const manifest = JSON.parse(
    readFileSync(join(__dirname, '../../package.json'), 'utf8'),
  ) as { exports: Record<string, string> }
  const served = new Set(Object.keys(manifest.exports))

  it(`serves every subpath @jbrowse/core@${previous.version} served`, () => {
    const undeclared = previous.subpaths.filter(
      s => !served.has(s) && !(s in KNOWN_SUBPATH_REMOVALS),
    )
    expect(undeclared).toEqual([])
  })

  it('has no stale SUBPATH_REMOVALS entries', () => {
    const published = new Set(previous.subpaths)
    // stale two ways: the subpath came back, or the release never served it
    const stale = Object.keys(KNOWN_SUBPATH_REMOVALS).filter(
      s => served.has(s) || !published.has(s),
    )
    expect(stale).toEqual([])
  })
})
