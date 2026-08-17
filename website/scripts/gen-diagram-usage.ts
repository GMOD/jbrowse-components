// Generates the "which doc uses which diagram" table in
// `website/diagrams/README.md`, read off the docs that actually embed each
// figure.
//
//   pnpm gen-diagram-usage           rewrite the table
//   pnpm gen-diagram-usage --check   CI gate, through `pnpm autogen`
//
// The table was hand-maintained, which made it the one place in the diagram
// pipeline nothing checked. `diagrams.ts` ties a source to the figure it
// rendered, and `check-figure-refs.ts` ties a doc's `<Figure src>` to the store
// — between them a source can be renamed, a figure can move to another page, or
// a diagram can lose its last reader, and every gate stays green while this
// table says otherwise. It is also the table a reader consults to answer "where
// does this picture appear", which is the question a rename breaks.
//
// A source nobody embeds is FATAL rather than a blank cell. `pnpm diagrams`
// renders every source in the directory and `figures.lock` then carries its
// bytes forever, so an unused one is a picture the site pays for and never
// shows — and a blank cell in a generated table reads as "this does nothing"
// rather than as "somebody has to fix this". The two ways to reach it are a
// diagram whose page was deleted and a diagram written before its page.
//
// The section column is the nearest markdown heading above the `<Figure>`,
// which is what tells two diagrams on one page apart. It is derived rather than
// written for the reason the whole table is: a heading gets reworded, and a
// hand-written note beside it does not.
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import {
  checkOrWrite,
  docFiles,
  formatMarkdown,
  markdownTableLines,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { docsDir, repoRoot } from './paths.ts'

const diagramsDir = join(repoRoot, 'website', 'diagrams')
const readmePath = join(diagramsDir, 'README.md')

// The same two extensions diagrams.ts renders, and the same `<name>.png`
// mapping. Kept in step by the check below rather than by an import: this file
// asks which docs name a figure, and that question is about the PNG's name.
const SOURCE_EXT = /\.(dot|svg)$/

// Every `<Figure src="…">` in the corpus check-captions.ts and
// check-figure-refs.ts also walk.
const FIGURE_RE = /<Figure\b[^>]*?\bsrc="([^"]*)"[^>]*?>/g
const HEADING_RE = /^#{1,6}\s+(.*?)\s*$/

interface Use {
  doc: string
  section: string
}

/**
 * Where each `/img/<name>.png` is embedded, with the nearest heading above it.
 *
 * Reads the file line by line rather than matching over the whole text so the
 * heading comes along without a second index pass. A figure above every heading
 * — the shape a page whose figure IS the page takes, dataflow.md today — gets
 * an empty section and its row names the doc alone.
 */
function collectUses(): Map<string, Use[]> {
  const uses = new Map<string, Use[]>()
  for (const file of docFiles(docsDir)) {
    const doc = relative(docsDir, file)
    let section = ''
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const heading = HEADING_RE.exec(line)
      if (heading) {
        section = heading[1]!
        continue
      }
      for (const match of line.matchAll(FIGURE_RE)) {
        const src = match[1]!
        const name = /^\/img\/(.*)\.png$/.exec(src)?.[1]
        if (name !== undefined) {
          uses.set(name, [...(uses.get(name) ?? []), { doc, section }])
        }
      }
    }
  }
  return uses
}

function rows(): string[] {
  const uses = collectUses()
  const orphans: string[] = []
  const out: string[] = []
  for (const source of readdirSync(diagramsDir).filter(f =>
    SOURCE_EXT.test(f),
  )) {
    const name = source.replace(SOURCE_EXT, '')
    const found = uses.get(name) ?? []
    if (found.length === 0) {
      orphans.push(source)
      continue
    }
    const where = found
      .map(u => {
        const link = `[\`docs/${u.doc}\`](../docs/${u.doc})`
        return u.section ? `${link} — ${u.section}` : link
      })
      .join('<br />')
    out.push(`| \`${source}\` | ${where} |`)
  }
  if (orphans.length > 0) {
    throw new Error(
      `${orphans.length} diagram source(s) no doc embeds:\n${orphans
        .map(
          o =>
            `  ${o} — nothing carries <Figure src="/img/${o.replace(SOURCE_EXT, '.png')}">`,
        )
        .join(
          '\n',
        )}\nEmbed it, or delete the source and its figures.lock line.`,
    )
  }
  return out.sort()
}

checkOrWrite({
  path: readmePath,
  content: formatMarkdown(
    spliceGeneratedBlock({
      path: readmePath,
      marker: 'DIAGRAM USAGE',
      body: markdownTableLines(['Source', 'Used in'], rows()),
    }),
    readmePath,
  ),
  label: 'diagram usage table',
  staleHint: 'run `pnpm autogen`',
})
