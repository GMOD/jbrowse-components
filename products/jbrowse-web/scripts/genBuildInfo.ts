import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { git } from './sourceSnapshot.ts'

// The short hash goes into the bundle for the About dialog.
export function genBuildInfo() {
  const hash = git(['rev-parse', '--short', 'HEAD'], import.meta.dirname)
  writeFileSync(
    resolve(import.meta.dirname, '../src/buildInfo.ts'),
    hash
      ? `export const gitCommit = '${hash}'\n`
      : `export const gitCommit: string | undefined = undefined\n`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  genBuildInfo()
}
