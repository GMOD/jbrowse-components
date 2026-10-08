// Fails when the config JSON schema no longer admits a slot path or an enum
// member a release shipped. The schema URL is one per major and the website
// deploy republishes it from main, so a slot deleted or renamed without a
// `retired` entry leaves the schema every config of that major validates
// against, and the app loads that config without the setting.
//
// `scripts/release.ts` runs `--freeze` on a stable release, which adds the
// release's paths to the major's baseline. Until a major has a stable release
// there is no baseline and nothing to check. A deliberate break deletes its
// baseline lines by hand, where a reviewer sees them.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { slotPaths } from './configSlotPaths.ts'

const root = join(import.meta.dirname, '..')
const { version } = JSON.parse(
  readFileSync(join(root, 'products/jbrowse-web/package.json'), 'utf8'),
) as { version: string }
const major = version.split('.')[0]
const schemaPath = join(root, `website/static/schema/v${major}/config.json`)
const baselinePath = join(root, `scripts/configSlotPaths.v${major}.txt`)

const current = slotPaths(JSON.parse(readFileSync(schemaPath, 'utf8')))
const baseline = existsSync(baselinePath)
  ? readFileSync(baselinePath, 'utf8').split('\n').filter(Boolean)
  : []

if (process.argv.includes('--freeze')) {
  const frozen = [...new Set([...baseline, ...current])].sort()
  writeFileSync(baselinePath, `${frozen.join('\n')}\n`)
  console.log(
    `wrote ${relative(root, baselinePath)}: ${frozen.length} paths, ${frozen.length - baseline.length} new`,
  )
  process.exit(0)
}

const admitted = new Set(current)
const missing = baseline.filter(path => !admitted.has(path))
if (missing.length) {
  console.error(
    [
      `${relative(root, schemaPath)} no longer admits ${missing.length} path(s) a v${major} release shipped:`,
      ...missing.map(path => `  - ${path}`),
      '',
      "Name each on its schema's `retired` map, with the lift that carries the old value to today's slots, and keep a removed enum value as a legacy value. Then `pnpm autogen`.",
    ].join('\n'),
  )
  process.exit(1)
}
console.log(
  baseline.length
    ? `config slot paths: all ${baseline.length} shipped paths still admitted`
    : `config slot paths: no v${major} baseline yet, nothing to check`,
)
