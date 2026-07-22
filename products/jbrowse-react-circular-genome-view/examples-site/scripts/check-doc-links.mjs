// Validate + suggest links in this examples-site:
//   node scripts/check-doc-links.mjs
// Fails (exit 1) on any link to a generated doc page that no longer exists, and
// on any site-internal `../<page>/#<section>` cross-link whose page or section
// no longer exists (these break silently on a rename).
// Then prints suggested reference links for config `type:`s used in examples
// that aren't linked anywhere in the prose yet. Shared impl lives in
// @jbrowse/browser-test-utils so every product's script stays identical.
import path from 'path'
import { fileURLToPath } from 'url'

import {
  findBrokenCrossLinks,
  findBrokenDocLinks,
  suggestDocLinks,
} from '@jbrowse/browser-test-utils'

import { pages } from '../src/examples.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const src = path.join(root, 'src')
// the checked-out website docs tree the generated pages are built from
const referenceDir = path.join(root, '..', '..', '..', 'website', 'docs')

const contentDirs = [path.join(src, 'docs'), path.join(src, 'pages')]

const broken = findBrokenDocLinks({ contentDirs, referenceDir })
for (const b of broken) {
  console.log(`BROKEN ${b.url}\n       in ${path.relative(root, b.file)}`)
}

const brokenCross = findBrokenCrossLinks({ contentDirs, pages })
for (const b of brokenCross) {
  console.log(
    `BROKEN ${b.url}  (${b.reason})\n       in ${path.relative(root, b.file)}`,
  )
}

const suggestions = suggestDocLinks({
  exampleDirs: [path.join(src, 'examples')],
  referenceDir,
  contentDirs,
})
if (suggestions.length) {
  console.log('\nSuggested reference links (config types not yet linked):')
  for (const s of suggestions) {
    console.log(`  ${path.relative(root, s.file)}  ${s.term}`)
    for (const u of s.urls) {
      console.log(`      ${u}`)
    }
  }
}

const brokenCount = broken.length + brokenCross.length
console.log(
  `\n${brokenCount} broken link(s), ${suggestions.length} suggestion(s)`,
)
process.exit(brokenCount ? 1 : 0)
