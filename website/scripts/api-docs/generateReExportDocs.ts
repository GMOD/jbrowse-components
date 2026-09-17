import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { markdownTable, rewriteMarkerBlock } from './util.ts'

// Render the served-package table into the dependencies guide from the
// generated re-export manifest, so the guide says what the host actually
// serves. The manifest is `scripts/generateReExports.ts`'s answer: every
// `@jbrowse` package jbrowse-web bundles, at every subpath its exports map
// publishes, with the worker's stub-or-real verdict per subpath.
//
// One row per package rather than one per subpath: 420 subpath rows would be
// the exports maps restated, and the exports map is what a plugin author's
// editor already reads. The row says how many subpaths and which of them the
// RPC worker serves for real, which is the only per-package fact a plugin
// author cannot read off the map.
//
// The guide opts in with a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- REEXPORT_MODULES START -->
//   <!-- REEXPORT_MODULES END -->
//
// Editing between the markers is pointless — it is overwritten on regen.

const MANIFEST = 'packages/core/src/ReExports/reExports.generated.json'

interface ManifestModule {
  package: string
  names: string[]
  worker: 'real' | 'stub'
}

interface Row {
  name: string
  description: string
  subpaths: number
  stubbed: number
  apiPage?: string
}

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
    modules: Record<string, ManifestModule>
  }
}

function packageDir(name: string) {
  const short = name.replace('@jbrowse/', '')
  for (const group of ['packages', 'plugins']) {
    const dir = path.join(group, short.replace(/^plugin-/, ''))
    try {
      const manifest = JSON.parse(
        readFileSync(path.join(dir, 'package.json'), 'utf8'),
      ) as { name: string; description?: string }
      if (manifest.name === name) {
        return { dir, description: manifest.description ?? '' }
      }
    } catch {
      // not this group
    }
  }
  throw new Error(`${MANIFEST} names ${name}, which is not a workspace package`)
}

// Only a package with `#api`-tagged exports has a page, so linking every served
// package produced nine dead links the website link check fails on.
function apiPageFor(dir: string) {
  const id = path.basename(dir)
  return dir.startsWith('packages/') &&
    existsSync(path.join('website/docs/api', `${id}.md`))
    ? id
    : undefined
}

export function collectReExports(): Row[] {
  const byPackage = new Map<string, Row>()
  for (const mod of Object.values(readManifest().modules)) {
    let row = byPackage.get(mod.package)
    if (!row) {
      const { dir, description } = packageDir(mod.package)
      row = {
        name: mod.package,
        description,
        subpaths: 0,
        stubbed: 0,
        apiPage: apiPageFor(dir),
      }
      byPackage.set(mod.package, row)
    }
    row.subpaths += 1
    if (mod.worker === 'stub') {
      row.stubbed += 1
    }
  }
  return [...byPackage.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function workerCell(row: Row) {
  if (row.stubbed === 0) {
    return 'all of it'
  }
  if (row.stubbed === row.subpaths) {
    return 'none; a stub with its names'
  }
  return `${row.subpaths - row.stubbed} of ${row.subpaths} subpaths; the rest stubbed`
}

function renderTable(rows: Row[]) {
  return markdownTable(
    ['Package', 'What it provides', 'Subpaths', 'Real in the RPC worker'],
    rows.map(
      r =>
        `| ${r.apiPage ? `[\`${r.name}\`](/docs/api/${r.apiPage})` : `\`${r.name}\``} | ${r.description} | ${r.subpaths} | ${workerCell(r)} |`,
    ),
  )
}

export function writeReExportDocs({ check = false } = {}) {
  return rewriteMarkerBlock(
    'REEXPORT_MODULES',
    renderTable(collectReExports()),
    { check },
  )
}
