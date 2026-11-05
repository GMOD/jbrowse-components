// Every slug in the curated order lists (guide-categories.ts) has to name a
// page that exists.
//
// The lists rank pages within a category; an unlisted page falls to the end
// alphabetically, which is also what an entry naming no page does. So a slug
// that goes stale — the page renamed, the page split, the page deleted — is
// inert rather than broken, and the section it was meant to lead quietly
// reverts to alphabetical order with nothing reporting it. TUTORIAL_ORDER
// carried `multiway_synteny` that way, against a page renamed to
// `multiway_synteny_grape_peach_cacao` long before, so the curated position was
// doing nothing.
//
// It also holds the landing page's first two sections to Getting started, then
// genomes.jbrowse.org: the grant aim is JBrowse on other groups' websites, and
// the pair had been swapped back three times.
//
// Run: `pnpm check-guide-order`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  GUIDE_ORDER,
  TUTORIAL_CATEGORIES,
  TUTORIAL_NO_THUMB,
  TUTORIAL_ORDER,
} from '../src/lib/guide-categories.ts'
import { docFiles, parseFrontmatter, reportProblems } from './check-utils.ts'
import { docRelative, docsDir, websiteDir } from './paths.ts'

// A page's slug is its filename, or the `slug:` its frontmatter declares. Only
// the files directly in the directory count — docFiles walks down, and a nested
// page answering for a top-level slug would make this pass on drift.
function slugsIn(dirName: string): Set<string> {
  const depth = dirName === '' ? 1 : dirName.split('/').length + 1
  return new Set(
    docFiles(join(docsDir, dirName))
      .map(full => docRelative(full))
      .filter(rel => rel.split('/').length === depth)
      .map(rel => {
        const fm =
          parseFrontmatter(readFileSync(join(docsDir, rel), 'utf8')) ?? {}
        return (
          fm.slug ??
          rel
            .split('/')
            .pop()!
            .replace(/\.mdx?$/, '')
        )
      }),
  )
}

// TUTORIAL_ORDER also ranks cards the tutorials landing page shows that are not
// pages under docs/tutorials/: the quickstarts and the cookbook live at the
// docs root, and an EXTERNAL_CARDS entry links out of the site entirely. Those
// keys are read off the landing page rather than restated here, so retiring a
// card is caught by this check instead of leaving a second stale slug behind.
const landing = readFileSync(
  join(websiteDir, 'src/pages/docs/tutorials/index.astro'),
  'utf8',
)
const externalCards = new Set(
  [...landing.matchAll(/key: '([^']+)'/g)].map(m => m[1]!),
)

const errors: string[] = []
let checked = 0

const tutorialSlugs = slugsIn('tutorials')
const rootSlugs = slugsIn('')

for (const slug of TUTORIAL_ORDER) {
  checked++
  if (tutorialSlugs.has(slug) || externalCards.has(slug)) {
    continue
  }
  // A root-level page reached only from the landing page still exists; one
  // that exists nowhere is the failure.
  if (rootSlugs.has(slug)) {
    continue
  }
  errors.push(
    `TUTORIAL_ORDER lists '${slug}', which is no page under docs/tutorials/ ` +
      `and no page at the docs root. Its curated position ranks nothing — ` +
      `rename it to the page's current slug, or drop it.`,
  )
}

for (const slug of TUTORIAL_NO_THUMB) {
  checked++
  if (
    !tutorialSlugs.has(slug) &&
    !externalCards.has(slug) &&
    !rootSlugs.has(slug)
  ) {
    errors.push(
      `TUTORIAL_NO_THUMB lists '${slug}', which is no page under ` +
        `docs/tutorials/ or the docs root. The landing page renders a thumbnail for any card ` +
        `not in this set, so a stale entry means a card links a webp nobody ` +
        `generated.`,
    )
  }
}

for (const [dirName, slugs] of Object.entries(GUIDE_ORDER)) {
  const pages = slugsIn(dirName)
  for (const slug of slugs) {
    checked++
    if (!pages.has(slug)) {
      errors.push(
        `GUIDE_ORDER['${dirName}'] lists '${slug}', which is no page under ` +
          `docs/${dirName}/. Its curated position ranks nothing.`,
      )
    }
  }
}

const LEADING_TUTORIAL_CATEGORIES = ['Getting started', 'genomes.jbrowse.org']
const leading = TUTORIAL_CATEGORIES.slice(0, LEADING_TUTORIAL_CATEGORIES.length)
if (leading.join('\n') !== LEADING_TUTORIAL_CATEGORIES.join('\n')) {
  errors.push(
    `TUTORIAL_CATEGORIES starts ${JSON.stringify(leading)}; it must start ` +
      `${JSON.stringify(LEADING_TUTORIAL_CATEGORIES)}. The grant aim is ` +
      `JBrowse running on other groups' websites, so installing it leads the ` +
      `tutorials page and genomes.jbrowse.org follows. This is a standing ` +
      `directive, not a judgement call to revisit.`,
  )
}

reportProblems(
  errors,
  `${checked} curated order slug(s) across TUTORIAL_ORDER, TUTORIAL_NO_THUMB and GUIDE_ORDER each name a page that exists.`,
)
