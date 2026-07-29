import { execFile } from 'child_process'
import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { promisify } from 'util'

import { format, resolveConfig } from 'prettier'

// Generated markdown is hand-authored prose (docstrings) reassembled by code,
// so its line breaks/blank lines don't reliably match what `pnpm format`
// would produce. Run it through prettier before writing so generated output
// is format-clean and `pnpm gendocs` is idempotent.
//
// Lives apart from util.ts so the pure markdown/parse helpers there stay
// importable (e.g. from unit tests) without pulling in prettier, which is
// ESM-only and doesn't load under Jest's CommonJS runtime.
export async function writeFormatted(path: string, content: string) {
  const config = await resolveConfig(path)
  const formatted = await format(content, {
    ...config,
    filepath: path,
  })
  fs.writeFileSync(path, formatted)
}

// Run the repo formatter over already-written files: the marker-block
// generators splice raw tables into the hand-written guides, which nothing else
// re-wraps.
//
// This used to be a prettier pass over every doc, re-run until it stopped
// changing anything. It cost ~12s a run and, in the steady state, changed
// nothing at all — `writeFormatted` had already formatted each generated page,
// and `pnpm gendocs` then ran oxfmt over the very same directories. oxfmt is the
// repo's formatter (`pnpm format`), so running it here is what actually decides
// the committed bytes, it does the whole tree in ~3s, and there is no second
// formatter to drift from.
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
