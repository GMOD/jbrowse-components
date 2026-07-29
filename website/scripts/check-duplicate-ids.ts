// Fails on any built page that renders more than one element with the same
// `id`.
//
// Several remark plugins mint raw-HTML ids (remark-config-cli-tabs' Config/CLI
// tabs, spec-recipe's figure dialogs) and nothing checked them. A collision is
// silent but not harmless: those ids drive CSS-only radio tabs keyed on
// `name`/`for`, so two widgets sharing a group leave the first showing no panel
// at all — which is how a Config/CLI widget shipped blank on
// config_guides/alignments_track.md and quantitative_track.md. Duplicate ids
// also quietly defeat the `--check-anchors` gate that runs beside this one,
// since a fragment resolves to whichever element comes first.
//
// rehypeSlug already suffixes repeated heading slugs (-1, -2), so ordinary
// headings can't trip this; what it catches is plugin- and layout-emitted
// markup.
//
// Operates on dist/ (run `pnpm build` first), like check-llms. In CI this runs
// in the `buildwebsite` job right after the build. Run: `pnpm check-dupe-ids`,
// or pass a directory to scan somewhere else.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { reportProblems, walkFiles } from './check-utils.ts'

const distDir = process.argv[2] ?? join(import.meta.dirname, '..', 'dist')

// blog/index.astro renders each post through its own renderMarkdown call and
// concatenates them, so rehypeSlug — which only dedupes within one call — can't
// see that two posts both have a "Downloads" heading. Reported rather than
// silently skipped: the collision is real (an anchor there resolves to the
// first post's heading), it just predates this check and is its own fix.
const KNOWN = new Set(['blog/index.html'])

function duplicateIds(html: string) {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const match of html.matchAll(/<[^>]+\sid="([^"]*)"/g)) {
    const id = match[1] ?? ''
    if (seen.has(id)) {
      dupes.add(id)
    }
    seen.add(id)
  }
  return [...dupes]
}

const errorLines: string[] = []
let checked = 0
for (const file of walkFiles(distDir, n => n.endsWith('.html'))) {
  const rel = file.slice(distDir.length + 1)
  const dupes = duplicateIds(readFileSync(file, 'utf8'))
  checked++
  if (dupes.length > 0) {
    const line = `  ${rel}\n    → duplicate id: ${dupes.join(', ')}`
    if (KNOWN.has(rel)) {
      console.warn(`known duplicate ids (not failing the build):\n${line}`)
    } else {
      errorLines.push(line, '')
    }
  }
}
if (errorLines.length) {
  errorLines.unshift(
    `Found built pages rendering more than one element per id:\n`,
  )
}
reportProblems(errorLines, `No duplicate ids across ${checked} built page(s).`)
