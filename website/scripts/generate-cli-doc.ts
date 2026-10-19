import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { checkOrWrite } from './check-utils.ts'
import { docsDir, repoRoot } from './paths.ts'
import { readmeMirrorPage } from './readmeMirror.ts'

// Mirrors products/jbrowse-cli/README.md into website/docs/cli.md. That README
// is itself generated from the CLI (products/jbrowse-cli/generate_readme.sh
// concatenates preamble.md with live `jbrowse <command> --help` output, run on
// the package's prepack), so it — not this doc — is the source of truth for
// command usage. To change the docs: edit the CLI command (or preamble.md),
// regenerate the README, then run `pnpm autogen`. CI parity via `--check`.

const readmePath = join(repoRoot, 'products', 'jbrowse-cli', 'README.md')
const outPath = join(docsDir, 'cli.md')

const title = 'Command line tools (JBrowse CLI)'
const description =
  'Install JBrowse Web and build its config.json from the shell with ' +
  '@jbrowse/cli — create, add-assembly, add-track, text-index, and the rest'

// The README is an npm package readme, so it points at @jbrowse/img on npm. On
// the docs site the sibling page is the better target. The lookbehind skips a
// URL already inside a markdown link target, so a bare URL is never
// double-wrapped.
function rewriteImgLink(md: string) {
  return md.replaceAll(
    /(?<!\]\()https:\/\/www\.npmjs\.com\/package\/@jbrowse\/img/g,
    '[@jbrowse/img](/docs/jbrowse-img)',
  )
}

// Drop the README's own frontmatter block; the website frontmatter supplies the
// page title (and the README's legacy Docusaurus id/toplevel fields aren't
// valid here).
function stripFrontmatter(md: string) {
  return md.replace(/^---\n[\s\S]*?\n---\n+/, '')
}

checkOrWrite({
  path: outPath,
  content: readmeMirrorPage({
    readmePath,
    outPath,
    title,
    description,
    editHint:
      'edit the CLI (or its preamble.md), regenerate the README, then run `pnpm autogen`',
    body: rewriteImgLink(stripFrontmatter(readFileSync(readmePath, 'utf8'))),
  }),
  label: 'cli.md',
  staleHint: 'run `pnpm autogen`',
})
