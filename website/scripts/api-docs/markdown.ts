import { firstParagraph } from './agentText.ts'

import type { Example } from './jsDocTags.ts'

// Shared markdown builders used by both generators.
export function codeBlock(...lines: string[]) {
  return ['```js', ...lines, '```'].join('\n')
}

// Flatten free-form JSDoc prose into one safe table cell: collapse newlines
// (a pipe table row can't span lines) and escape markdown metacharacters used
// here: backslash (escape char) and literal `|` (table column separator).
export function tableCell(text: string | undefined) {
  return (text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim()
}

// Prose that keeps its paragraph breaks inside a cell. A cell is one line of
// markdown, so a blank line isn't available — `<br><br>` is what a multi-
// paragraph slot description renders as, and a fence becomes a `<pre>`. A `<`
// outside a code span is text: `multiz<N>way` would otherwise open an `<n>`
// element that swallows the rest of the cell.
export function proseCell(text: string | undefined) {
  return cellBlocks(text ?? '', part =>
    part
      .split(/\n\s*\n/)
      .map(p => escapeProseAngles(tableCell(p)))
      .filter(Boolean)
      .join('<br><br>'),
  )
}

function escapeProseAngles(text: string) {
  return text
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replaceAll('<', '&lt;')))
    .join('')
}

// Cell content with its fenced code as `<pre>` blocks, since a fence needs
// lines of its own and a cell is one line; the prose between goes through
// `prose`.
function cellBlocks(text: string, prose: (part: string) => string) {
  return text
    .split(/```\w*\n([\s\S]*?)```/)
    .map((part, i) =>
      i % 2 ? `<pre><code>${preCell(part)}</code></pre>` : prose(part),
    )
    .filter(Boolean)
    .join('')
}

// Raw-HTML escaping for a cell: `&`/`<`/`>` so code can't be read as markup,
// `|` so it can't split the row.
function escapeCellHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;')
}

// Newlines inside a cell are written as `&#10;` (the row is one line) and
// line-leading indentation as `&#160;` — ordinary leading spaces are stripped
// by the raw-HTML round trip the table goes through, nbsp survives.
function preCell(code: string) {
  return escapeCellHtml(code.trim()).replace(
    /\n[ \t]*/g,
    m => `&#10;${'&#160;'.repeat(m.length - 1)}`,
  )
}

// Code in a table cell — a slot's default, a member's type signature. Short
// code renders inline; anything longer shows its head and opens in full in a
// dialog, so one 300-character generic type can't blow up the row it sits in.
// Raw `<code>` rather than a markdown code span because these carry backticks
// (jexl defaults are template literals). `link` rewrites the escaped code with
// anchors; the dialog's trigger is a button, which can't hold one.
export const MAX_INLINE_CELL_CODE = 64
export function codeCell(
  code: string | undefined,
  link = (html: string) => html,
) {
  const flat = (code ?? '').replace(/\s+/g, ' ').trim()
  return flat
    ? flat.length <= MAX_INLINE_CELL_CODE
      ? `<code>${link(escapeCellHtml(flat))}</code>`
      : dialogCell(
          `<code>${escapeCellHtml(`${flat.slice(0, MAX_INLINE_CELL_CODE - 1).trimEnd()}…`)}</code>`,
          `<pre><code>${link(preCell(code ?? ''))}</code></pre>`,
        )
    : ''
}

// A value too big for its cell — a 300-character type, a jexl default, an
// authored #example — behind a trigger that opens it in a modal `<dialog>`.
// Expanding it in place (what a `<details>` did) reflows the whole table around
// a multi-line `<pre>` that then has nowhere to go but a quarter-width column;
// the dialog gets the width of the window instead. Native `<dialog>`, so Escape
// and the backdrop click (wired in DocsLayout.astro) close it, and the
// `method="dialog"` form needs no script at all.
function dialogCell(trigger: string, body: string) {
  return [
    '<span class="cell-more">',
    `<button type="button" class="cell-more-trigger">${trigger}</button>`,
    '<dialog class="cell-dialog">',
    '<form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form>',
    body,
    '</dialog>',
    '</span>',
  ].join('')
}

// An authored `#example` inside a table cell. Its prose stays markdown (a cell
// parses as inline markdown, so backticks and links still render).
export function exampleCell(examples: Example[]) {
  return examples
    .map(ex =>
      dialogCell(
        ex.label ? `example: ${ex.label}` : 'example',
        cellBlocks(ex.content, part => {
          const prose = escapeProseAngles(tableCell(part))
          return prose && `<p>${prose}</p>`
        }),
      ),
    )
    .join('')
}

// A GFM pipe table: header cells, then one already-built `| a | b | c |` row
// per entry. Rows are joined with a single newline (not `section`'s blank-line
// join) since a table's rows must be consecutive lines with no gaps.
//
// `prettier-ignore` pins the compact form. Otherwise the formatter pads every
// cell in a column out to its widest member, so one long slot description
// inflates a whole page (LinearAlignmentsDisplay: 57KB of padding) and editing
// that one description reflows every row into the diff.
// GFM splits a row on every `|` not written `\|`, a code span included, so an
// unescaped pipe in a description or a `string | number` type shifts the cells
// after it. Each caller assembles its own row, so the count is checked here.
function cellCount(row: string) {
  return row.replaceAll('\\|', '').split('|').length - 2
}

export function markdownTable(headers: string[], rows: string[]) {
  for (const row of rows) {
    if (cellCount(row) !== headers.length) {
      throw new Error(
        `a table row has ${cellCount(row)} cells under ${headers.length} headers (${headers.join(', ')}); escape the \`|\` in a cell with tableCell or codeCell:\n  ${row}`,
      )
    }
  }
  return rows.length
    ? [
        '<!-- prettier-ignore -->',
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows,
      ].join('\n')
    : ''
}

// The shared skeleton every generated config/model page wears: frontmatter, a
// one-line auto-generated preamble that folds in the source-code
// link, then the page body. The config and model generators differ only in
// `notes` and `sourcePath`, so the skeleton lives here to stay single-sourced.
export function docPage({
  id,
  title,
  sidebarLabel,
  description,
  notes,
  sourcePath,
  body,
}: {
  id: string
  title: string
  sidebarLabel: string
  description: string
  notes: string
  sourcePath: string
  body: string
}) {
  const intro = [
    notes,
    provenance(sourcePath),
    `[View source](https://github.com/GMOD/jbrowse-components/blob/main/${sourcePath}).`,
  ]
    .filter(Boolean)
    .join(' ')
  return `---
id: ${id}
title: ${title}
description: ${JSON.stringify(description)}
sidebar_label: ${sidebarLabel}
---

${intro}

${body}
`
}

// A page's meta description: the opening of its docstring as plain text, or
// `fallback` for a type whose docstring says nothing. A long opening ends at
// the last whole sentence that fits, and is cut mid-sentence only when its
// first sentence alone is too long.
const DESCRIPTION_CHARS = 200

export function pageDescription(docs: string, fallback: string) {
  const text = firstParagraph(docs, Infinity)
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/[`*_]/g, '')
  const sentenceEnds = [
    ...text.slice(0, DESCRIPTION_CHARS + 1).matchAll(/[.!?](?=\s+[A-Z"(])/g),
  ]
  const lastEnd = sentenceEnds.at(-1)?.index
  return text.length <= DESCRIPTION_CHARS
    ? text || fallback
    : lastEnd !== undefined
      ? text.slice(0, lastEnd + 1)
      : firstParagraph(text, DESCRIPTION_CHARS)
}

// Where a documented element comes from, derived from its source path: which
// plugin provides it (the actionable fact — that plugin must be present), or
// that it is built into JBrowse core. Empty for anything else (e.g. products).
function provenance(sourcePath: string): string {
  const [workspace, name] = sourcePath.split('/')
  return workspace === 'plugins' && name
    ? `Provided by the \`${name}\` plugin.`
    : workspace === 'packages' && name
      ? 'Built into JBrowse core.'
      : ''
}

// Join non-empty parts with blank lines between them. Falsy parts (including the
// `0` from `arr.length && ...`) are dropped, so empty sections vanish cleanly.
export function section(...parts: (string | false | 0 | undefined)[]) {
  return parts.filter(Boolean).join('\n\n')
}

// Wraps content in an `## Overview` section. Returns empty string when all
// parts are falsy, so no stray heading appears. On a sparse page whose whole
// overview is a single prose paragraph (no sub-headings or `<details>`
// sections), the `## Overview` heading outweighs its content, so the prose is
// emitted bare.
export function overviewSection(...parts: (string | false | 0 | undefined)[]) {
  const body = section(...parts)
  const hasSections = /(^|\n)(#{2,6} |<details)/.test(body)
  return body ? (hasSections ? `## Overview\n\n${body}` : body) : ''
}

// Renders authored #example blocks under a consistent heading. Empty when none
// were authored.
//
// heading controls the level: '## Example usage' for top-level config/model
// pages, '#### Example usage' for API exports. Sub-example labels nest one
// level deeper (### for ##, ##### for ####).
export function exampleSection(
  examples: Example[],
  heading = '## Example usage',
) {
  const level = '#'.repeat(heading.length - heading.replace(/^#+/, '').length)
  return examples.length
    ? section(
        heading,
        ...examples.map(ex =>
          section(ex.label && `${level}# Example: ${ex.label}`, ex.content),
        ),
      )
    : ''
}
