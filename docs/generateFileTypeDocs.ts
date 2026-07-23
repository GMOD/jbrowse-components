import fs from 'fs'

import {
  getAllFiles,
  jsDocText,
  markdownTable,
  parsePipeTags,
  parseSourceFileSyntactic,
  rewriteGroupedMarkerBlocks,
  rewriteMarkerBlock,
  tableCell,
} from './util.ts'

// Render the format -> adapter -> track type tables into the "Supported file
// types" guide straight from the adapter config schemas, so the routing table
// can never drift from the code. It was hand-maintained and had gone wrong in
// both directions: a new adapter simply never appeared, and BedpeAdapter was
// filed under FeatureTrack when every bedpe track in test_data/ is a
// VariantTrack (its `#trackType` tag said so all along).
//
// An adapter opts into the table by adding a `#fileFormat` tag alongside the
// `#config`/`#trackType` tags it already carries:
//
//   /**
//    * #config BedpeAdapter
//    * #trackType VariantTrack
//    * #fileFormat variants | BEDPE
//    */
//
// i.e. `#fileFormat <group> | <format label> | <note>`, where the note is
// optional. The adapter name comes from `#config` and the track type from
// `#trackType`, so neither is restated here. A guide opts a group in with a
// marker pair, regenerated on `pnpm autogen`:
//
//   <!-- FILE_TYPES variants START -->
//   <!-- FILE_TYPES variants END -->
//
// Editing between the markers is pointless — it is overwritten on regen.

interface Row {
  format: string
  adapter: string
  trackType: string
  note: string
}

// Adapters that are not configured as a track's `adapter` slot: their "track
// type" column names where the config actually goes instead.
const NON_TRACK_SLOTS: Record<string, string> = {
  ReferenceSequenceTrack: 'assembly `sequence`',
  TextSearchAdapter: '`aggregateTextSearchAdapters` / `textSearching`',
}

function tagValue(comment: string, tag: string) {
  return new RegExp(`#${tag}\\s+(\\S+)`).exec(comment)?.[1]
}

// Collect every `#fileFormat`-tagged adapter, grouped by its `#fileFormat`
// group and preserving source order within a group. The tags sit in the same
// JSDoc comment as `#config`, which is attached to the configSchema variable
// statement.
function collectFormats(files: string[], groups: Record<string, Row[]>) {
  for (const file of files) {
    if (!fs.readFileSync(file, 'utf8').includes('#fileFormat')) {
      continue
    }
    const visit = (node: import('typescript').Node) => {
      const comment = jsDocText(node)
      const tags = parsePipeTags(comment, 'fileFormat', file)
      if (tags.length) {
        const adapter = tagValue(comment, 'config')
        if (!adapter) {
          throw new Error(`${file}: #fileFormat tag with no #config name`)
        }
        const trackType = tagValue(comment, 'trackType')
        if (!trackType) {
          throw new Error(
            `${file}: ${adapter} has #fileFormat but no #trackType`,
          )
        }
        for (const [group, format, note] of tags) {
          ;(groups[group] ??= []).push({ format, adapter, trackType, note })
        }
      }
      node.forEachChild(visit)
    }
    visit(parseSourceFileSyntactic(file))
  }
}

// A track type is rendered as a link to its own config page, except for the
// pseudo-types that name a non-track config slot.
function trackTypeCell(trackType: string) {
  return (
    NON_TRACK_SLOTS[trackType] ??
    `[${trackType}](/docs/config/${trackType.toLowerCase()})`
  )
}

// Rows are sorted by format label rather than left in source order, which is
// git-ls-files order and so groups by plugin directory — putting e.g. BigWig
// after GC content for no reason a reader can see.
function renderTable(rows: Row[]) {
  const anyNote = rows.some(r => r.note)
  return markdownTable(
    ['Format', 'Adapter', 'Track type', ...(anyNote ? ['Notes'] : [])],
    [...rows]
      .sort((a, b) => a.format.localeCompare(b.format))
      .map(
        r =>
          `| ${[
            tableCell(r.format),
            `[${r.adapter}](/docs/config/${r.adapter.toLowerCase()})`,
            trackTypeCell(r.trackType),
            ...(anyNote ? [tableCell(r.note)] : []),
          ].join(' | ')} |`,
      ),
  )
}

// In `check` mode, report which docs have a stale table instead of rewriting —
// used by CI to fail when an adapter changed but the docs were not regenerated.
export function writeFileTypeDocs(files: string[], { check = false } = {}) {
  const groups: Record<string, Row[]> = {}
  collectFormats(files, groups)
  const { stale, seen } = rewriteGroupedMarkerBlocks(
    'FILE_TYPES',
    (group, file) => {
      const rows = groups[group]
      if (!rows) {
        throw new Error(
          `${file}: FILE_TYPES group "${group}" has no #fileFormat-tagged adapters`,
        )
      }
      // `prettier-ignore` pins the compact table `markdownTable` emits, for the
      // same reason as the color tables — see generateColorDocs.
      return `<!-- prettier-ignore -->\n${renderTable(rows)}`
    },
    { check },
  )
  // A tagged adapter whose group no page renders is a silent no-op — the whole
  // point of the tag is that a new adapter shows up without anyone editing the
  // guide, so an unrendered group means the tag has a typo.
  for (const group of Object.keys(groups)) {
    if (!seen.has(group)) {
      throw new Error(
        `#fileFormat group "${group}" is not rendered by any doc — no <!-- FILE_TYPES ${group} START --> marker found`,
      )
    }
  }
  return stale
}

// The track -> display table in the tracks guide, from the same
// `new DisplayType({ name, trackType })` registrations that drive the "Display
// types" section of each Track's config page. Needs no tagging at all. The
// hand-written version listed 5 of the 11 track types and silently omitted
// MafTrack/GWASTrack/HicTrack/SyntenyTrack/LDTrack, each of which has its own
// guide page in the same directory.
//
// Not every registered type has a config page: displays parameterized from a
// shared factory at runtime (LDDisplay, LDTrackDisplay) carry no individually
// tagged #config, and neither do a few one-off displays. Link only what exists,
// so the table can still name them without emitting a dead link that fails the
// CI anchor check.
export function writeDisplayTypeDocs(
  displayTypesByTrack: Map<string, string[]>,
  configNames: Set<string>,
  { check = false } = {},
) {
  const link = (name: string) =>
    configNames.has(name)
      ? `[${name}](/docs/config/${name.toLowerCase()})`
      : name
  const rows = [...displayTypesByTrack]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([trackType, displays]) =>
        `| ${link(trackType)} | ${[...displays]
          .sort((a, b) => a.localeCompare(b))
          .map(link)
          .join('<br/>')} |`,
    )
  return rewriteMarkerBlock(
    'DISPLAY_TYPES',
    `<!-- prettier-ignore -->\n${markdownTable(['Track type', 'Display types'], rows)}`,
    { check },
  )
}

// A hand-written guide pulls in a type's `#gotcha` text with a marker pair:
//
//   <!-- GOTCHA PAFAdapter START -->
//   <!-- GOTCHA PAFAdapter END -->
//
// so the warning is authored once, at the definition site, and appears both on
// the generated config page and in the guide. Restating it by hand is how the
// query/target warning ended up phrased three different ways.
export function writeGotchaDocs(
  gotchasByConfig: Map<string, string[]>,
  { check = false } = {},
) {
  return rewriteGroupedMarkerBlocks(
    'GOTCHA',
    (name, file) => {
      const gotchas = gotchasByConfig.get(name)
      if (!gotchas?.length) {
        throw new Error(
          `${file}: GOTCHA "${name}" has no #gotcha-tagged text on its #config`,
        )
      }
      return gotchas.map(g => `:::caution Gotcha\n\n${g}\n\n:::`).join('\n\n')
    },
    { check },
  ).stale
}

// Run as a script: `node docs/generateFileTypeDocs.ts [--check]`. The guard
// keeps this inert when imported by generate.ts, so the tables aren't generated
// twice in one `pnpm gendocs`. The display-type table needs the whole-repo
// DisplayType scan that generate.ts already does, so it is regenerated there
// and only verified here.
if (process.argv[1]?.endsWith('generateFileTypeDocs.ts')) {
  const stale = writeFileTypeDocs(await getAllFiles(), {
    check: process.argv.includes('--check'),
  })
  if (stale.length) {
    console.error(
      `File type tables out of date, run \`pnpm autogen\`:\n${stale.map(f => `  ${f}`).join('\n')}`,
    )
    process.exit(1)
  }
  console.log('File type tables up to date')
}
