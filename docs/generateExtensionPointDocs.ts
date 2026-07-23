import fs from 'fs'

import {
  listSources,
  markdownTable,
  rewriteMarkerBlock,
  runMarkerScript,
} from './util.ts'

// Render a completeness index of every extension point into the hand-written
// extension_points guide, sourced from the actual registration/fire sites so the
// listing can never silently omit a point (the guide's per-point prose stays
// hand-written; only the index table is generated). Same docs-from-source idea
// as `#color`/`#config`/`#api`: each point is tagged once, at the canonical site
// where it is fired (or registered, for dynamically-fired points), with a JSDoc
//
//   /** #extensionPoint Core-extendSession | sync | Extend the session model */
//
// i.e. `#extensionPoint <id> | <sync|async> | <description>`. The guide opts the
// table in by dropping a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- EXTENSION_POINTS_INDEX START -->
//   <!-- EXTENSION_POINTS_INDEX END -->
//
// Editing between the markers is pointless — it is overwritten on regen.

// Source trees scanned for `#extensionPoint` tags.
const SOURCE_DIRS = ['packages', 'plugins', 'products']

interface ExtensionPoint {
  id: string
  kind: string
  description: string
}

// `#extensionPoint <id> | <sync|async> | <description>` occurrences in one file.
function collectFromFile(file: string, points: ExtensionPoint[]) {
  const re =
    /#extensionPoint\s+([\w-]+)\s*\|\s*(sync|async)\s*\|\s*([^\n*]+?)\s*(?:\*\/|\n)/g
  const text = fs.readFileSync(file, 'utf8')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    points.push({ id: m[1], kind: m[2], description: m[3].trim() })
  }
}

function collectExtensionPoints(): ExtensionPoint[] {
  const points: ExtensionPoint[] = []
  for (const dir of SOURCE_DIRS) {
    for (const file of listSources(dir)) {
      collectFromFile(file, points)
    }
  }
  // a tag duplicated across sites would otherwise double a row; keep the first
  const byId = new Map<string, ExtensionPoint>()
  for (const p of points) {
    const existing = byId.get(p.id)
    if (existing) {
      if (existing.kind !== p.kind || existing.description !== p.description) {
        throw new Error(
          `#extensionPoint ${p.id} is tagged inconsistently in more than one place`,
        )
      }
    } else {
      byId.set(p.id, p)
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function renderTable(points: ExtensionPoint[]) {
  return markdownTable(
    ['Extension point', 'Type', 'Description'],
    points.map(p => `| \`${p.id}\` | ${p.kind} | ${p.description} |`),
  )
}

// In `check` mode, report which docs have a stale index instead of rewriting —
// used by CI to fail when an extension point was added but the docs were not
// regenerated.
export function writeExtensionPointDocs({ check = false } = {}) {
  // `prettier-ignore` pins the compact table `markdownTable` emits, for the same
  // reason as the color/file-type tables — see generateColorDocs. Without it
  // prettier padded the block every `pnpm format` while this generator emitted
  // it compact, and the whitespace-insensitive --check never caught the churn.
  return rewriteMarkerBlock(
    'EXTENSION_POINTS_INDEX',
    `<!-- prettier-ignore -->\n${renderTable(collectExtensionPoints())}`,
    { check },
  )
}

// Run as a script: `node docs/generateExtensionPointDocs.ts [--check]`. The guard
// keeps this inert when imported by generate.ts (argv[1] is generate.ts there),
// so the table isn't generated twice in one `pnpm gendocs`.
if (process.argv[1]?.endsWith('generateExtensionPointDocs.ts')) {
  runMarkerScript('Extension point index', writeExtensionPointDocs)
}
