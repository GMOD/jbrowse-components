import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// undefined whenever git cannot answer: a published tarball carries no .git and
// some CI images carry no git binary. Every reader treats absence as unknown
// rather than failing a build over it.
function git(args: string[]) {
  try {
    return execFileSync('git', args, {
      cwd: import.meta.dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}

/**
 * What a build was made from. The short hash goes into the bundle for the About
 * dialog; `writeBuildStamp.ts` writes the full commit and its date into
 * `build/build-info.json`, which the screenshot generator reads to catch
 * figures captured from a build older than the checkout.
 */
export function gitProvenance() {
  return {
    commit: git(['rev-parse', 'HEAD']),
    commitDate: git(['log', '-1', '--format=%cI']),
  }
}

export function genBuildInfo() {
  const hash = git(['rev-parse', '--short', 'HEAD'])
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
