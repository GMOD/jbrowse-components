// Validate + suggest links in this examples-site:
//   node scripts/check-doc-links.mjs
// Fails (exit 1) on a link to a generated doc page that no longer exists, on a
// site-internal `../<page>/#<section>` cross-link whose page or section is gone
// (these break silently on a rename), on a section with no src/docs/<slug>.md
// (which renders as a demo with no explanation, equally silent), and on prose
// past its cap. Advisory output: reference links still worth adding, and prose
// getting long.
//
// The run itself is `runExamplesSiteChecks` in @jbrowse/browser-test-utils, so
// all four sites' copies of this file stay identical. Only `pages` and the
// paths differ, which is what this passes in.
import path from 'path'
import { fileURLToPath } from 'url'

import { runExamplesSiteChecks } from '@jbrowse/browser-test-utils'

import { pages } from '../src/examples.ts'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

process.exit(
  runExamplesSiteChecks({
    root,
    pages,
    // the checked-out website docs tree the generated pages are built from
    referenceDir: path.join(root, '..', '..', '..', 'website', 'docs'),
  })
    ? 1
    : 0,
)
