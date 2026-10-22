import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { gitProvenance } from './genBuildInfo.ts'

// What `build/` was made from, written beside the bundle by `postbuild`.
//
// `version.txt` stays one bare version line: @jbrowse/capture reads it off any
// hosted instance to refuse a pre-v5 app. The commit goes in `build-info.json`
// instead, where a new field can never confuse that reader. `build/` is
// replaced in place and a build from last week looks exactly like one from this
// minute, so the readers that matter are the ones driving the built app:
// `website/scripts/build-staleness.ts` compares this commit against HEAD before
// a figure run.
const buildDir = resolve(import.meta.dirname, '..', 'build')
const packageJsonPath = resolve(import.meta.dirname, '..', 'package.json')

export function writeBuildStamp() {
  const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    version: string
  }
  writeFileSync(resolve(buildDir, 'version.txt'), version)
  // JSON.stringify drops the fields git could not fill, so a tarball build
  // stamps what it knows and the generator reports the rest as unknown
  const { commit, commitDate } = gitProvenance()
  writeFileSync(
    resolve(buildDir, 'build-info.json'),
    `${JSON.stringify(
      { version, commit, commitDate, builtAt: new Date().toISOString() },
      null,
      2,
    )}\n`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeBuildStamp()
}
