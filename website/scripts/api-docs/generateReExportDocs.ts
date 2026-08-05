import * as ts from 'typescript'

import {
  lastTaggedLine,
  markdownTable,
  parseSourceFileSyntactic,
  rewriteMarkerBlock,
  runMarkerScript,
} from './util.ts'

// Render the `@jbrowse/core` re-export table into the dependencies guide from
// the re-export list itself. The guide already called that file "the source of
// truth" and then restated it by hand two paragraphs later, which is the shape
// of every table this run replaced — and it was five paths short: the whole
// `pluggableElementTypes/{View,Adapter,Display,Track,Widget}Type` family was
// missing, so a plugin importing one had no way to learn it resolves to the
// host's copy rather than being bundled.
//
// Getting this wrong is not a cosmetic docs bug. A path in the list resolves to
// the host's single instance; one that isn't gets copied into the plugin, and a
// second copy of the configuration system or the model types does not
// interoperate with the first.
//
// The paths are the array elements. Each carries its description as a
// `// #reexport <what it provides>` comment directly above it, so the two can't
// separate. Only `@jbrowse/core/*` is tagged and rendered — the framework and
// MUI entries are described by category in the guide's prose, and one row per
// MUI component subpath would be a hundred rows of noise.
//
// The guide opts in with a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- REEXPORT_MODULES START -->
//   <!-- REEXPORT_MODULES END -->
//
// Editing between the markers is pointless — it is overwritten on regen.

const SOURCE = 'packages/core/src/ReExports/list.ts'
const PREFIX = '@jbrowse/core/'

interface Module {
  path: string
  provides: string
}

// The `#reexport` description attached above an array element. The scan starts
// at the element's full start, so it sees only the trivia between the previous
// element and this one; `lastTaggedLine` handles the head-of-line and last-wins
// rules, and its comment explains why both are needed here.
function tagAbove(node: ts.Node, text: string) {
  return lastTaggedLine(
    (ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [])
      .map(r => text.slice(r.pos, r.end))
      .join('\n'),
    'reexport',
  )
}

export function collectReExports(): Module[] {
  const source = parseSourceFileSyntactic(SOURCE)
  const text = source.getFullText()
  const out: Module[] = []
  const walk = (node: ts.Node) => {
    if (ts.isArrayLiteralExpression(node)) {
      for (const el of node.elements) {
        if (ts.isStringLiteral(el) && el.text.startsWith(PREFIX)) {
          const provides = tagAbove(el, text)
          if (!provides) {
            throw new Error(
              `${SOURCE}: '${el.text}' has no \`// #reexport <what it provides>\` comment above it, so it would be missing from the re-export table in the dependencies guide`,
            )
          }
          out.push({ path: el.text, provides })
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(source)
  if (!out.length) {
    throw new Error(`${SOURCE}: found no ${PREFIX}* entries to document`)
  }
  return out
}

// Source order, not alphabetical: the list is grouped by concern already
// (plugin entry point, then the pluggable-element types, then config, then the
// util subpaths), and that grouping is worth more to a reader than sorting.
function renderTable(modules: Module[]) {
  return markdownTable(
    ['Module', 'What it provides'],
    modules.map(m => `| \`${m.path}\` | ${m.provides} |`),
  )
}

export function writeReExportDocs({ check = false } = {}) {
  return rewriteMarkerBlock(
    'REEXPORT_MODULES',
    renderTable(collectReExports()),
    { check },
  )
}

if (process.argv[1]?.endsWith('generateReExportDocs.ts')) {
  runMarkerScript('Re-export module table', writeReExportDocs)
}
