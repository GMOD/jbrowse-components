import fs from 'fs'

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

// Re-format files already on disk, returning whether any of them changed. Lets
// the generator drive formatting to a fixed point (see formatOutput).
export async function formatDocs(paths: string[]) {
  let changed = false
  for (const path of paths) {
    const original = fs.readFileSync(path, 'utf8')
    const config = await resolveConfig(path)
    const formatted = await format(original, { ...config, filepath: path })
    if (formatted !== original) {
      fs.writeFileSync(path, formatted)
      changed = true
    }
  }
  return changed
}
