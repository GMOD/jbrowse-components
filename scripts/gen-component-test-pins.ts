// Regenerates (or, with --check, verifies) the `@jbrowse/*` pin lists the
// component-test apps install from. Reads the workspace package.json files
// only, so it runs on a clean checkout without packing anything.
import fs from 'node:fs'
import path from 'node:path'

import { pinnedFiles, readWorkspace } from './componentTestPins.ts'

const root = path.resolve(import.meta.dirname, '..')
const check = process.argv.includes('--check')
const files = pinnedFiles(root, readWorkspace(root))

const stale = files.filter(
  file => fs.readFileSync(file.path, 'utf8') !== file.content,
)

if (check) {
  if (stale.length > 0) {
    console.error(
      `component-test pins are out of date — run \`pnpm gen-component-test-pins\`:\n${stale
        .map(file => `  ${path.relative(root, file.path)}`)
        .join('\n')}`,
    )
    process.exit(1)
  }
  console.log(`component-test pins are up to date (${files.length} files)`)
} else {
  for (const file of stale) {
    fs.writeFileSync(file.path, file.content)
    console.log(`wrote ${path.relative(root, file.path)}`)
  }
  console.log(`synced ${files.length} component-test manifests`)
}
