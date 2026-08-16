// Validate + suggest links in this examples-site:
//   node scripts/check-doc-links.mjs
// The whole run is `checkExamplesSiteDocLinks` in @jbrowse/browser-test-utils —
// what stays here is the anchor, since node resolves a module's relative paths
// from its real location and only the call site knows which site is calling.
import { checkExamplesSiteDocLinks } from '@jbrowse/browser-test-utils'

process.exit(await checkExamplesSiteDocLinks(import.meta.url))
