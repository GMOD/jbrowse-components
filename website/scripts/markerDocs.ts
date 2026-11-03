import fs from 'node:fs'
import path from 'node:path'

import { readDoc, writeDoc } from './api-docs/format.ts'
import { isDocFile, repoFiles } from './check-utils.ts'
import { markerBlocks, markerLine, spliceMarkerBlocks } from './markerBlocks.ts'
import { repoRoot } from './paths.ts'

import type { MarkerBlock } from './markerBlocks.ts'

// The docs the marker sweeps walk. agent-docs is swept alongside the published
// guides: the architecture spec restates several of the same tables the guides
// do, and hand-mirroring one into the other is the drift these generators exist
// to remove — the spec used to carry an explicit "then mirror it here"
// instruction for exactly that. A file is only touched if it holds the marker
// pair, so widening the sweep costs nothing to the docs that don't opt in.
//
// From the same listing as the sources, so under the pre-push hook another
// agent's untracked doc is neither spliced nor indexed.
const MARKER_DOC_ROOTS = [
  'website/docs/',
  'agent-docs/',
  'website/diagrams/',
  'website/release_announcement_drafts/',
]

function markerDocs() {
  return repoFiles().filter(
    f =>
      MARKER_DOC_ROOTS.some(root => f.startsWith(root)) &&
      isDocFile(path.basename(f)),
  )
}

// Each doc's blocks. Every generator sweeps the whole tree for its own marker,
// so a doc is rescanned only when a splice changed its text.
const scanned = new Map<string, { text: string; blocks: MarkerBlock[] }>()

function blocksOf(file: string) {
  const text = readDoc(file)
  let entry = scanned.get(file)
  if (entry?.text !== text) {
    entry = {
      text,
      blocks: text.includes('<!-- BEGIN GENERATED ')
        ? markerBlocks(text, file)
        : [],
    }
    scanned.set(file, entry)
  }
  return entry.blocks
}

// Every grouped `name` block in the docs under `prefix`, for a generator that
// validates its groups before it renders them.
export function markerDocBlocks(name: string, prefix: string) {
  return markerDocs()
    .filter(file => file.startsWith(prefix))
    .flatMap(file =>
      blocksOf(file).flatMap(block =>
        block.name === name && block.group !== undefined
          ? [{ ...block, file, group: block.group }]
          : [],
      ),
    )
}

// The markers a generator asked to render, checked against the docs' own pairs
// by `assertMarkersAndDocsAgree`. The doc side is also what the MARKER_INDEX
// table renders, so the index is read off the docs rather than off this
// registry and therefore lists itself.
const markersWritten = new Set<string>()

// Blocks a generator outside this process splices, with the script that does:
// generateConfigManifest bundles the live source tree, which a doc generator
// cannot. Named here so the both-directions check stays exact.
const WRITTEN_ELSEWHERE = new Map([
  ['PLOT_SETTINGS', 'scripts/generateConfigManifest.ts'],
  ['V4_CONFIG_MIGRATION', 'scripts/generateConfigManifest.ts'],
])

// Every marker pair the docs carry, marker name to the docs carrying it. A
// grouped marker (`COLOR_TABLE alignments-indicators`) counts under its name.
export function markerBlocksInDocs() {
  const found = new Map<string, Set<string>>()
  for (const file of markerDocs()) {
    for (const { name } of blocksOf(file)) {
      const docs = found.get(name)
      if (docs) {
        docs.add(file)
      } else {
        found.set(name, new Set([file]))
      }
    }
  }
  return found
}

// Both halves of "a generated table and the doc that renders it still know
// about each other", which nothing checked. Either direction is silent and
// permanent, and both are one rename away:
//
//   - a marker no doc carries renders nowhere. The generator reports it up to
//     date, because the docs it did not touch are all identical to themselves.
//     Removing the pair from a page is enough — the table's last reader can go
//     with every gate green, which is the failure `gen-diagram-usage.ts` calls
//     fatal for the same reason.
//   - a pair no generator writes keeps whatever was committed forever. Renaming
//     a marker in the generator is both failures at once: the new name renders
//     nowhere and the old block freezes.
//
// `markersWritten` is what the run actually asked for, so a partial run
// (`markers.ts <filter>`) checks only its own markers; pass `both: false`
// there, since a marker the run never invoked is not evidence of an
// ungenerated block. `writtenElsewhere` names the markers another process
// writes, which a run counts as written.
export function assertMarkersAndDocsAgree({
  both = true,
  writtenElsewhere = [],
}: {
  both?: boolean
  writtenElsewhere?: readonly string[]
} = {}) {
  const inDocs = markerBlocksInDocs()
  const problems = [
    ...writtenElsewhere
      .filter(marker => !inDocs.has(marker))
      .map(
        marker =>
          `  ${marker} — written by another process, but no doc carries a \`${markerLine('BEGIN', marker)}\` pair.`,
      ),
    ...[...markersWritten, ...WRITTEN_ELSEWHERE.keys()]
      .filter(marker => !inDocs.has(marker))
      .map(
        marker =>
          `  ${marker} — generated, but no doc carries a \`${markerLine('BEGIN', marker)}\` pair. Render it in a doc, or delete the generator.`,
      ),
    ...[...WRITTEN_ELSEWHERE]
      .filter(
        ([marker, writer]) =>
          !fs
            .readFileSync(path.join(repoRoot, writer), 'utf8')
            .includes(`'${marker}'`),
      )
      .map(
        ([marker, writer]) =>
          `  ${marker} — markerDocs.ts says ${writer} writes it, and ${writer} no longer names it.`,
      ),
    ...(both
      ? [...inDocs.keys()]
          .filter(
            marker =>
              !markersWritten.has(marker) &&
              !WRITTEN_ELSEWHERE.has(marker) &&
              !writtenElsewhere.includes(marker),
          )
          .map(
            marker =>
              `  ${marker} — ${[...inDocs.get(marker)!].join(', ')} carries the pair, but no generator writes it. The block keeps whatever was committed.`,
          )
      : []),
  ]
  if (problems.length > 0) {
    throw new Error(
      `${problems.length} marker(s) and the docs disagree:\n${problems.join('\n')}`,
    )
  }
}

// The named markers no generator in this run wrote, for a run that owes them.
export function unwrittenMarkers(markers: readonly string[]) {
  return markers.filter(marker => !markersWritten.has(marker))
}

interface SweepOptions {
  // The block may render nothing, and an empty one is an answer rather than a
  // source parse that stopped matching.
  allowEmpty?: boolean
  // Only these docs; every doc by default.
  files?: string[]
}

// Rewrite every `marker` block in the docs that carry one, returning the docs
// whose block content changed. `writeDoc` keeps them off disk under `--check`,
// so the list is then the stale docs.
//
// The --check comparison is byte-exact, and has to stay that way. It used to
// normalize whitespace and hyphen runs first, from a time when the committed
// tables were column-padded by the formatter and the generators emitted them
// compact — `markdownTable` now pins the compact form with `prettier-ignore`,
// so the two agree byte for byte and the normalization only cost accuracy:
// every cell is already whitespace-collapsed by `tableCell`/`codeCell`, so the
// space clause matched nothing, while the `-+` clause silently passed a stale
// doc whose only change was a hyphen run. Renaming a documented flag from
// `--force` to `-force`, or an em-dash `--` to `-`, regenerated the table and
// reported it up to date.
function sweep(
  marker: string,
  render: (block: MarkerBlock, file: string) => string,
  { allowEmpty = false, files = markerDocs() }: SweepOptions,
) {
  markersWritten.add(marker)
  return files.flatMap(file => {
    const original = readDoc(file)
    const updated = blocksOf(file).some(b => b.name === marker)
      ? spliceMarkerBlocks({
          text: original,
          file,
          name: marker,
          allowEmpty,
          render: block => render(block, file),
        })
      : original
    return updated === original ? [] : writeDoc(file, updated)
  })
}

function wrongShape(file: string, block: MarkerBlock, expected: string) {
  return new Error(
    `${file}:${block.begin + 1}: ${markerLine('BEGIN', block.name, block.group)} — ${block.name} ${expected}`,
  )
}

export function rewriteMarkerBlock(
  marker: string,
  block: string,
  options: SweepOptions = {},
) {
  return sweep(
    marker,
    (found, file) => {
      if (found.group !== undefined) {
        throw wrongShape(file, found, 'takes no group')
      }
      return block
    },
    options,
  )
}

// The grouped sibling of rewriteMarkerBlock, for markers that name which group
// they render (`<!-- BEGIN GENERATED COLOR_TABLE alignments-indicators -->`) so
// one generator can feed many blocks across many docs. `render` returns a
// group's block body, and throws when the group is unknown — the message
// belongs to the caller, since an unrecognized group is always an authoring
// typo.
//
// Returns the docs whose block content changed (the stale ones, under
// `--check`) and the groups some doc actually rendered, so a caller can catch a
// tagged group that no page pulls in.
export function rewriteGroupedMarkerBlocks(
  marker: string,
  render: (group: string, file: string) => string,
  options: SweepOptions = {},
) {
  const seen = new Set<string>()
  const changed = sweep(
    marker,
    (found, file) => {
      if (found.group === undefined) {
        throw wrongShape(file, found, 'names a group')
      }
      seen.add(found.group)
      return render(found.group, file)
    },
    options,
  )
  return { changed, seen }
}
