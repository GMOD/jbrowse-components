import { execFile } from 'child_process'
import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { promisify } from 'util'

// Generated pages are written raw and formatted in one `formatWithOxfmt` sweep
// at the end of the run (see generate.ts). Every path written here has to appear
// in that sweep, so a page can't ship unformatted — the package READMEs
// writeApiReadmes touches live outside the doc directories and are collected for
// exactly that reason.
export function writeDoc(file: string, content: string) {
  fs.writeFileSync(file, content)
}

// Run the repo formatter over already-written files. Generated markdown is
// hand-authored prose (docstrings) reassembled by code, so its wrapping doesn't
// match what `pnpm format` produces; the marker-block generators additionally
// splice raw tables into the hand-written guides, which nothing else re-wraps.
//
// oxfmt is the repo's formatter (`pnpm format`), so running it is what actually
// decides the committed bytes. This used to be prettier — per page as it was
// written, then over every doc again, re-run until it stopped changing anything.
// That cost ~12s a run to change nothing in the steady state, and left two
// formatters that had to agree on markdown forever or the `--check` gates would
// oscillate.
//
// The binary is resolved through node's resolver rather than spawned by name:
// the old prettier shell-out only found its binary via the PATH an npm script
// sets, so running `node generate.ts` directly spawned ENOENT and silently
// formatted nothing.
export async function formatWithOxfmt(paths: string[]) {
  const require = createRequire(import.meta.url)
  const bin = path.join(
    path.dirname(require.resolve('oxfmt/package.json')),
    'bin',
    'oxfmt',
  )
  await promisify(execFile)(process.execPath, [bin, ...paths])
}
