import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { buildProvenance } from './sourceSnapshot.ts'

// `version.txt` stays one bare version line: @jbrowse/capture reads it off any
// hosted instance to refuse a pre-v5 app. Provenance goes in `build-info.json`,
// where a new field cannot confuse that reader.
const buildDir = resolve(import.meta.dirname, '..', 'build')
const packageJsonPath = resolve(import.meta.dirname, '..', 'package.json')

export function writeBuildStamp(
  provenance: ReturnType<typeof buildProvenance>,
) {
  const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    version: string
  }
  writeFileSync(resolve(buildDir, 'version.txt'), version)
  writeFileSync(
    resolve(buildDir, 'build-info.json'),
    `${JSON.stringify({ version, ...provenance }, null, 2)}\n`,
  )
}
