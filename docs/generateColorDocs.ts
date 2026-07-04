import fs from 'fs'

import * as ts from 'typescript'

import {
  jsDocText,
  listDocs,
  normalizeMarkerWhitespace,
  parsePipeTags,
  runMarkerScript,
} from './util.ts'

// Render small color-swatch tables into the hand-written guides, sourced from
// the actual color constants so the docs can never drift from the code (the
// soft-clip/hard-clip legend in two guides once disagreed because both were
// hand-copied). Each documented color is tagged at its definition site with a
// JSDoc `#color` tag — same docs-from-source idea as `#api`/`#config`:
//
//   /** #color alignments-indicators | Insertion | Reads carry an insertion */
//   const insertion = '#800080'
//
// i.e. `#color <group> | <label> | <description>`. A guide opts a group in by
// dropping a marker pair, and the block between is regenerated on `pnpm
// autogen`:
//
//   <!-- COLOR_TABLE alignments-indicators START -->
//   <!-- COLOR_TABLE alignments-indicators END -->
//
// Editing between the markers is pointless — it is overwritten on regen.

// Files scanned for `#color` tags.
const COLOR_SOURCES = ['packages/core/src/ui/theme.ts']

interface Row {
  label: string
  description: string
  value: string
}

// Syntactic-only parse (no type checker / program) — we only read JSDoc text
// and string-literal initializers, which keeps this independent of theme.ts's
// heavy MUI imports.
function parseFile(file: string) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
}

// Every `#color <group> | <label> | <description>` tag in one comment. A color
// used in more than one context (e.g. the inter-chromosomal mate color appears
// in both the pair-orientation and insert-size legends) carries one tag per
// group, so it documents itself in each table.
function parseColorTags(comment: string | undefined, where: string) {
  return parsePipeTags(comment, 'color', where).map(
    ([group, label, description]) => ({ group, label, description }),
  )
}

// Collect tagged colors grouped by their `#color` group, preserving source
// order. Handles both top-level `const NAME = 'literal'` and string-valued
// members of an object literal (each member can carry its own JSDoc).
function collectColors(file: string, groups: Record<string, Row[]>) {
  const add = (comment: string | undefined, value: string, name: string) => {
    for (const tag of parseColorTags(comment, `${file} (${name})`)) {
      ;(groups[tag.group] ??= []).push({
        label: tag.label,
        description: tag.description,
        value,
      })
    }
  }
  parseFile(file).forEachChild(node => {
    if (ts.isVariableStatement(node)) {
      const stmtDoc = jsDocText(node)
      for (const d of node.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) {
          continue
        }
        if (ts.isStringLiteralLike(d.initializer)) {
          add(stmtDoc, d.initializer.text, d.name.text)
        } else if (ts.isObjectLiteralExpression(d.initializer)) {
          for (const p of d.initializer.properties) {
            if (
              ts.isPropertyAssignment(p) &&
              (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
              ts.isStringLiteralLike(p.initializer)
            ) {
              add(jsDocText(p), p.initializer.text, p.name.text)
            }
          }
        }
      }
    }
  })
}

function swatch(value: string) {
  const style = [
    'display:inline-block',
    'width:0.9em',
    'height:0.9em',
    `background-color:${value}`,
    'border:1px solid #8888',
    'border-radius:2px',
    'vertical-align:middle',
  ].join(';')
  return `<span style="${style}" title="${value}"></span>`
}

function renderTable(rows: Row[]) {
  const body = rows
    .map(
      r =>
        `| ${swatch(r.value)} | ${r.label} | \`${r.value}\` | ${r.description} |`,
    )
    .join('\n')
  return [
    '| Color | Name | Value | Description |',
    '| --- | --- | --- | --- |',
    body,
  ].join('\n')
}

function start(group: string) {
  return `<!-- COLOR_TABLE ${group} START -->`
}
function end(group: string) {
  return `<!-- COLOR_TABLE ${group} END -->`
}

// In `check` mode, report which docs have a stale table instead of rewriting —
// used by CI to fail when a color changed but the docs were not regenerated.
export function writeColorDocs({ check = false } = {}) {
  const groups: Record<string, Row[]> = {}
  for (const file of COLOR_SOURCES) {
    collectColors(file, groups)
  }
  const markerRe = /<!-- COLOR_TABLE (\S+) START -->/g
  const stale: string[] = []
  for (const file of listDocs('website/docs')) {
    const original = fs.readFileSync(file, 'utf8')
    let updated = original
    for (const [, group] of original.matchAll(markerRe)) {
      const rows = groups[group]
      if (!rows) {
        throw new Error(
          `${file}: COLOR_TABLE group "${group}" has no #color-tagged colors in ${COLOR_SOURCES.join(', ')}`,
        )
      }
      const block = `${start(group)}\n\n${renderTable(rows)}\n\n${end(group)}`
      const re = new RegExp(`${start(group)}[\\s\\S]*?${end(group)}`)
      updated = updated.replace(re, () => block)
    }
    if (check) {
      if (
        normalizeMarkerWhitespace(updated) !==
        normalizeMarkerWhitespace(original)
      ) {
        stale.push(file)
      }
    } else if (updated !== original) {
      fs.writeFileSync(file, updated)
    }
  }
  return stale
}

// Run as a script: `node docs/generateColorDocs.ts [--check]`. The guard keeps
// this inert when the module is imported by generate.ts (argv[1] is generate.ts
// there), so the tables aren't generated twice in one `pnpm gendocs`.
if (process.argv[1]?.endsWith('generateColorDocs.ts')) {
  runMarkerScript('Color tables', writeColorDocs)
}
