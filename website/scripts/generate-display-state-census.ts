// Generates ARCHITECTURE.md's slot-vs-property census: for every display, how
// many `#slot`, `#property` and `#volatile` tags its own directory declares.
//
// The section it feeds argues that the config slot is the default home for a
// display's state "by a wide margin", and it used to argue it with three pairs
// of numbers typed into the prose. They were right the day they were written
// and wrong within a fortnight — alignments went 45 -> 47 -> 48 -> 46 while the
// sentence still said 45 — and nothing could catch it, because
// check-doc-imports resolves the identifiers a doc names, never the counts it
// states about them. A number a reader could recount is a table by
// agent-docs/CLAUDE.md's own rule.
//
// **A display is a directory whose `index.ts` calls
// `pluginManager.addDisplayType`.** That is the registration itself rather than
// a name pattern, so a new display joins the table by being registered and a
// retired one leaves by not being. The receiver is load-bearing:
// `AlignmentsTrack/index.ts` calls `track.addDisplayType` to hang a display off
// a *track*, which registers nothing and would otherwise have arrived as an
// all-zero row.
//
// **Attribution is by directory**, the same allowance
// generate-display-hook-overrides.ts makes and for the same reason: the
// alternative is walking the compose graph, and a slot's inheritance chain is
// not what this section is counting. It counts what a display's own directory
// declares. Two consequences worth knowing rather than rediscovering:
//
//   - `LinearBasicDisplay`'s row includes `baseConfigSchema.ts`, i.e. the slots
//     `LinearCanvasBaseDisplay` declares for it and for `LinearVariantDisplay`.
//     The base lives inside the one directory, so the directory rule keeps them
//     together.
//   - Slots contributed by a shared fields file outside every display directory
//     (`heightModeConfigSchemaFields.ts`, `treeSidebarConfigSchemaFields.ts`)
//     are in nobody's row. They belong to whichever schemas splice them in,
//     which is a compose-graph question this table does not ask.
//
// Only the block between the markers is generated. Run: `pnpm autogen`
// (or `--check` in CI).
import { readFileSync } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'

import {
  checkOrWrite,
  isTsSource,
  markdownTableLines,
  spliceGeneratedBlock,
  walkFiles,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

const docPath = join(repoRoot, 'agent-docs', 'ARCHITECTURE.md')

const SCAN_ROOTS = ['plugins', 'packages', 'products']

const SKIP_DIRS = new Set([
  'node_modules',
  'esm',
  'dist',
  'build',
  'shaders',
  '__pycache__',
])

// The plugin's own registration, not a harness's: `testEnv.ts` and
// `testUtils.ts` also call `addDisplayType`, to have a display to drive, and
// neither registers a display type this repo ships.
const isRegistration = (file: string) => basename(file) === 'index.ts'

interface Census {
  display: string
  plugin: string
  slots: number
  properties: number
  volatiles: number
}

function countTags(dir: string) {
  const counts = { slots: 0, properties: 0, volatiles: 0 }
  for (const file of walkFiles(dir, isTsSource, SKIP_DIRS)) {
    const text = readFileSync(file, 'utf8')
    // The tag as JSDoc writes it: `* #slot`, `* #slot labels.name`. Anchored to
    // the comment leader so a `#slot` inside prose about slots is not a slot.
    counts.slots += text.match(/^\s*\*\s*#slot\b/gm)?.length ?? 0
    counts.properties += text.match(/^\s*\*\s*#property\b/gm)?.length ?? 0
    counts.volatiles += text.match(/^\s*\*\s*#volatile\b/gm)?.length ?? 0
  }
  return counts
}

function displayDirs() {
  const dirs: string[] = []
  for (const root of SCAN_ROOTS) {
    for (const file of walkFiles(join(repoRoot, root), isTsSource, SKIP_DIRS)) {
      if (!isRegistration(file)) {
        continue
      }
      if (
        readFileSync(file, 'utf8').includes('pluginManager.addDisplayType(')
      ) {
        dirs.push(dirname(file))
      }
    }
  }
  return dirs
}

function main() {
  const rows: Census[] = displayDirs()
    .map(dir => {
      const parts = relative(repoRoot, dir).split(sep)
      return {
        display: basename(dir),
        plugin: `${parts[0]}/${parts[1]}`,
        ...countTags(dir),
      }
    })
    // Slots descending, because the section's claim is about the top of this
    // list; ties by name so the output is stable.
    .sort((a, b) => b.slots - a.slots || a.display.localeCompare(b.display))

  const total = (key: keyof Omit<Census, 'display' | 'plugin'>) =>
    rows.reduce((sum, row) => sum + row[key], 0)

  const body = [
    '',
    `${rows.length} registered displays declare ${total('slots')} config slots, ` +
      `${total('properties')} MST properties and ${total('volatiles')} volatiles ` +
      "between them — counting what each display's own directory declares.",
    '',
    '<!-- prettier-ignore -->',
    ...markdownTableLines(
      ['Display', 'Plugin', '`#slot`', '`#property`', '`#volatile`'],
      rows.map(
        r =>
          `| \`${r.display}\` | \`${r.plugin}\` | ${r.slots} | ${r.properties} | ${r.volatiles} |`,
      ),
    ),
  ]

  checkOrWrite({
    path: docPath,
    content: spliceGeneratedBlock({
      path: docPath,
      marker: 'DISPLAY_STATE_CENSUS',
      body,
    }),
    label: 'display state census',
    staleHint: 'display state census',
  })
}

main()
