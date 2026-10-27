/**
 * Builds the UMD bundle against what the newest release before this commit
 * serves, the oldest JBrowse a hub config may load the published path on. A
 * failure names each import that release lacks, and means the change needs a
 * new path (`publish-umd.sh v2`), not an update to the one hub configs name.
 *
 * Run: `node plugins/blat/scripts/check-umd-floor.ts`
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchHostNames, hostShim } from '@jbrowse/core/ReExports/hostShim'
import * as esbuild from 'esbuild'

import { umdBuildOptions } from './umdBuild.ts'

const RELEASE = /^v(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/

function compareReleases(a: string, b: string) {
  const [, ...x] = RELEASE.exec(a)!
  const [, ...y] = RELEASE.exec(b)!
  for (let i = 0; i < 3; i++) {
    const d = Number(x[i]) - Number(y[i])
    if (d !== 0) {
      return d
    }
  }
  return x[3] === y[3]
    ? 0
    : x[3] === undefined
      ? 1
      : y[3] === undefined
        ? -1
        : x[3].localeCompare(y[3], 'en', { numeric: true })
}

const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim()

// an annotated tag's `^{}` line carries the commit it points at
const commitOf = new Map<string, string>()
for (const line of git('ls-remote', '--tags', 'origin', 'v*').split('\n')) {
  const [sha, ref] = line.split('\t')
  const tag = ref!.replace('refs/tags/', '')
  commitOf.set(tag.replace('^{}', ''), sha!)
}
const head = git('rev-parse', 'HEAD')
const floor = [...commitOf]
  .filter(([tag, sha]) => RELEASE.test(tag) && sha !== head)
  .map(([tag]) => tag)
  .sort(compareReleases)
  .at(-1)
if (!floor) {
  throw new Error('no release tag found on origin')
}

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const names = await fetchHostNames(floor)
try {
  await esbuild.build({
    ...umdBuildOptions(pluginRoot),
    plugins: [hostShim({ pluginName: 'Blat', names, host: floor })],
    write: false,
    logLevel: 'silent',
  })
} catch (error) {
  if (!(error instanceof Error && 'errors' in error)) {
    throw error
  }
  for (const { text, location } of (error as esbuild.BuildFailure).errors) {
    console.error(
      location ? `${location.file}:${location.line}: ${text}` : text,
    )
  }
  console.error(
    `The BLAT bundle imports what ${floor} does not serve, and hub configs may load it there. Publish it under a new path (publish-umd.sh v2) and point new configs at that; SKIP_FLOOR_CHECK=1 publishes a newly minted path.`,
  )
  process.exit(1)
}
console.log(`builds against ${floor}, the newest release before this commit`)
