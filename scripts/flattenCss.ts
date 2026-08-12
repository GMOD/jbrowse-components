// Inline a stylesheet's @import'd files into one self-contained CSS file.
//
// @jbrowse/react-app2/styles.css is published for consumers to import, and an
// @import of a bare package specifier in it resolves only inside a bundler.
// Flattening for publish means the shipped file also works as a plain
// <link href>, and drops a specifier the consumer's toolchain would otherwise
// have to resolve.
//
// **That stylesheet currently has no @import at all** — it was a single one of
// dockview's, and the workspace rewrite dropped the dependency. This runs and
// copies the file, which is the point: owning the entry point is what let that
// import disappear without breaking a consumer, and the next style we ship goes
// back through here. Keep it wired into build:css.
//
// Node's resolver is used (via createRequire) rather than postcss-import
// because a specifier may cross a package "exports" map — dockview-react's
// "./dist/styles/*" did — which postcss-import's resolver does not honor.
//
// Only @import of a bare/relative specifier is handled (no media queries, no
// url() rebasing) because that is all our own stylesheets use. url() would need
// rebasing on relocation; assert none appears rather than silently ship broken
// paths.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const IMPORT_RE = /@import\s+['"]([^'"]+)['"]\s*;/g

function flatten(file: string): string {
  const css = readFileSync(file, 'utf8')
  const require = createRequire(file)
  return css.replaceAll(IMPORT_RE, (_match, specifier: string) =>
    flatten(require.resolve(specifier)),
  )
}

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  throw new Error('usage: flattenCss.ts <input.css> <output.css>')
}

const flattened = flatten(resolve(input))
if (flattened.includes('url(')) {
  throw new Error(
    `${input}: flattened CSS contains url(), whose relative paths break when ` +
      'the file is relocated to the package root - add url() rebasing before ' +
      'shipping this',
  )
}
mkdirSync(dirname(resolve(output)), { recursive: true })
writeFileSync(resolve(output), flattened)
