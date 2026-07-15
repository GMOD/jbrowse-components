// Validate + suggest jbrowse.org/jb2/docs links in this examples-site:
//   node scripts/check-doc-links.mjs
// Fails (exit 1) on any link to a generated doc page that no longer exists.
// Then prints suggested reference links for config `type:`s used in examples
// that aren't linked anywhere in the prose yet. Shared impl lives in
// @jbrowse/browser-test-utils so every product's script stays identical.
import path from 'path'
import { fileURLToPath } from 'url'

import {
  findBrokenDocLinks,
  suggestDocLinks,
} from '@jbrowse/browser-test-utils'

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

console.log(
  `\n${broken.length} broken link(s), ${suggestions.length} suggestion(s)`,
)
process.exit(broken.length ? 1 : 0)
