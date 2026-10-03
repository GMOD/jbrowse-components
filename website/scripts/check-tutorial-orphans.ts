// Every tutorial has to be linked from another tutorial.
//
// The landing page and the user guide index list every page, so an orphan is
// still reachable, but a reader who finishes it has nowhere to go and a reader
// of its neighbours never learns it exists. `syri_synteny` carried five
// outbound See also links and none inbound, while the pages about rearrangements
// never named it.
//
// Run: `pnpm check-tutorial-orphans`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { docFiles, reportProblems } from './check-utils.ts'
import { docsDir } from './paths.ts'

const tutorialsDir = join(docsDir, 'tutorials')
const slugOf = (file: string) =>
  file.slice(file.lastIndexOf('/') + 1).replace(/\.md$/, '')

const pages = docFiles(tutorialsDir).filter(f => slugOf(f) !== 'CLAUDE')
const slugs = new Set(pages.map(slugOf))
const linked = new Set<string>()

for (const file of pages) {
  const self = slugOf(file)
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/\]\(\/docs\/tutorials\/([a-z0-9_]+)/g)) {
    if (m[1] !== self) {
      linked.add(m[1]!)
    }
  }
}

const errors = [...slugs]
  .filter(slug => !linked.has(slug))
  .map(
    slug =>
      `tutorials/${slug}.md: no other tutorial links it. Add it to the ` +
      `## See also of the page a reader would come from.`,
  )

reportProblems(
  errors,
  `${slugs.size} tutorials, each linked from another tutorial.`,
)
