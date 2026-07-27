import fs from 'fs'

import {
  listSources,
  markdownTable,
  rewriteMarkerBlock,
  runMarkerScript,
} from './util.ts'

// Render the display-foundations table into the hand-written creating_display
// guide from the source itself, so the "used by" column can't drift. It already
// did once: the guide claimed a `RegionTooLargeMixin` foundation used by the arc
// and circular-chord displays, when arc composes `GlobalFetchMixin`,
// `RegionTooLargeMixin` is never composed directly by a display, and the chord
// display isn't an LGV display at all.
//
// Two tags, both on the JSDoc block that already carries `#stateModel`:
//
//   the foundation mixin  /** #stateModel MultiRegionDisplayMixin
//                             #displayFoundationDef <what it brings> */
//   each display using it /** #stateModel LinearWiggleDisplay
//                             #displayFoundation MultiRegionDisplayMixin */
//
// A new display joins the table by tagging itself; nothing is restated, since
// the display's own name comes from the `#stateModel` tag above it.
//
// The guide opts in with a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- DISPLAY_FOUNDATIONS START -->
//   <!-- DISPLAY_FOUNDATIONS END -->
//
// Editing between the markers is pointless — it is overwritten on regen.

const SOURCE_DIRS = ['packages', 'plugins']

// `#stateModel <Name>` followed, within the same JSDoc, by one of the two tags.
// The `[^*]*(?:\*(?!/)[^*]*)*?` run walks comment body without escaping the
// block, so a tag can't be picked up from the next JSDoc down the file.
const DEF =
  /#stateModel\s+(\w+)[^*]*(?:\*(?!\/)[^*]*)*?#displayFoundationDef\s+([^\n*]+)/g
const USE =
  /#stateModel\s+(\w+)[^*]*(?:\*(?!\/)[^*]*)*?#displayFoundation\s+(\w+)/g

interface Foundation {
  name: string
  brings: string
  displays: string[]
}

export function collectFoundations() {
  const defs = new Map<string, string>()
  const uses = new Map<string, string[]>()
  for (const dir of SOURCE_DIRS) {
    for (const file of listSources(dir)) {
      const src = fs.readFileSync(file, 'utf8')
      if (!src.includes('#displayFoundation')) {
        continue
      }
      for (const [, name, brings] of src.matchAll(DEF)) {
        defs.set(name!, brings!.trim())
      }
      for (const [, model, foundation] of src.matchAll(USE)) {
        uses.set(foundation!, [...(uses.get(foundation!) ?? []), model!])
      }
    }
  }
  for (const foundation of uses.keys()) {
    if (!defs.has(foundation)) {
      throw new Error(
        `#displayFoundation ${foundation} has no #displayFoundationDef on the mixin itself`,
      )
    }
  }
  const foundations: Foundation[] = [...defs].map(([name, brings]) => ({
    name,
    brings,
    displays: [...(uses.get(name) ?? [])].sort((a, b) => a.localeCompare(b)),
  }))
  // Most-used first, so the common case leads; name breaks ties for stability.
  return foundations.sort(
    (a, b) =>
      b.displays.length - a.displays.length || a.name.localeCompare(b.name),
  )
}

function renderTable(foundations: Foundation[]) {
  return markdownTable(
    ['Foundation', 'Brings', 'Used by'],
    foundations.map(
      f =>
        `| \`${f.name}()\` | ${f.brings} | ${f.displays
          .map(d => `\`${d}\``)
          .join(', ')} |`,
    ),
  )
}

export function writeDisplayFoundationDocs({ check = false } = {}) {
  return rewriteMarkerBlock(
    'DISPLAY_FOUNDATIONS',
    `<!-- prettier-ignore -->\n${renderTable(collectFoundations())}`,
    { check },
  )
}

if (process.argv[1]?.endsWith('generateDisplayFoundationDocs.ts')) {
  runMarkerScript('Display foundations table', writeDisplayFoundationDocs)
}
