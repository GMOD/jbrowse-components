// Validate + suggest links in this examples-site:
//   node scripts/check-doc-links.mjs
// Fails (exit 1) on any link to a generated doc page that no longer exists, on
// any site-internal `../<page>/#<section>` cross-link whose page or section no
// longer exists (these break silently on a rename), and on any section with no
// src/docs/<slug>.md (which renders as a demo with no explanation, and is
// likewise silent).
// Then prints suggested reference links for config `type:`s used in examples
// that aren't linked anywhere in the prose yet. Shared impl lives in
// @jbrowse/browser-test-utils so every product's script stays identical.
import path from 'path'
import { fileURLToPath } from 'url'

import {
  findBrokenCrossLinks,
  findBrokenDocLinks,
  findMissingDocs,
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

const { missing, orphans } = findMissingDocs({
  docsDir: path.join(src, 'docs'),
  pages,
})
for (const m of missing) {
  console.log(
    `NO DOC ${m.slug}  (section of page "${m.page}")\n` +
      `       expected ${path.relative(root, m.expected)}`,
  )
}
for (const o of orphans) {
  console.log(`ORPHAN src/docs/${o}.md  (no section with that slug renders it)`)
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

const failures = broken.length + brokenCross.length + missing.length
console.log(
  `\n${broken.length + brokenCross.length} broken link(s), ` +
    `${missing.length} missing doc(s), ${orphans.length} orphan(s), ` +
    `${suggestions.length} suggestion(s)`,
)
process.exit(failures ? 1 : 0)
