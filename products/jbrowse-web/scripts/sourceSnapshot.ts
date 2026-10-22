import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
  utimesSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Free of `import.meta`, which jest's CJS transform cannot load: the website's
// build-staleness check and its test import this module.

// What the app bundle is built from. Over-inclusive: a package outside
// @jbrowse/web's dependency closure costs a needless staleness warning, no
// more. The capture server serves test_data from the checkout, so a new fixture
// needs no rebuild.
export const APP_PATHS = [
  ':(top)packages',
  ':(top)plugins',
  ':(top)products/jbrowse-web',
  ':(top)config',
  ':(top)pnpm-lock.yaml',
  ':(top,exclude)products/jbrowse-web/test_data',
]

// undefined whenever git cannot answer: a published tarball carries no .git and
// some CI images carry no git binary. Every reader treats absence as unknown.
export function git(args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  try {
    return execFileSync('git', args, {
      cwd,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}

/**
 * The tree id of the app sources as they sit on disk, uncommitted and untracked
 * edits included. A scratch index keeps the checkout's own index and the shared
 * stash list untouched; the only trace is loose objects that `git gc` prunes.
 */
export function workingTreeSnapshot(cwd: string) {
  const index = git(['rev-parse', '--git-path', 'index'], cwd)
  if (index === undefined) {
    return undefined
  }
  const dir = mkdtempSync(join(tmpdir(), 'jbrowse-snapshot-'))
  try {
    const scratch = join(dir, 'index')
    const real = resolve(cwd, index)
    if (existsSync(real)) {
      copyFileSync(real, scratch)
      // git trusts an entry's stat data only for a file older than the index
      // itself, so a fresh mtime would hide a same-size edit from the same
      // second as the last index write
      const { atime, mtime } = statSync(real)
      utimesSync(scratch, atime, mtime)
    }
    const env = { ...process.env, GIT_INDEX_FILE: scratch }
    return git(['add', '-A', '--', ...APP_PATHS], cwd, env) === undefined
      ? undefined
      : git(['write-tree'], cwd, env)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * What a build is made from, read before it compiles so an edit or a commit
 * made during the compile cannot be stamped as part of it. `writeBuildStamp.ts`
 * writes it into `build/build-info.json`, which
 * `website/scripts/build-staleness.ts` compares with the checkout.
 */
export function buildProvenance(cwd: string) {
  return {
    commit: git(['rev-parse', 'HEAD'], cwd),
    commitDate: git(['log', '-1', '--format=%cI'], cwd),
    tree: workingTreeSnapshot(cwd),
    builtAt: new Date().toISOString(),
  }
}
