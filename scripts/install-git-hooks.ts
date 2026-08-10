// Points this clone's git hooks at .githooks/, which holds the oxfmt
// pre-commit hook. Runs from `postinstall`, so it has to stay quiet where
// there is no git to configure -- a source tarball, a vendored copy, CI
// checkouts that install before fetching .git.
//
// core.hooksPath replaces .git/hooks wholesale rather than copying a file into
// it, so the hook stays under review in the repo and no stale copy survives an
// edit.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

try {
  execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd: root,
    stdio: 'ignore',
  })
} catch {
  process.exit(0)
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: root,
    stdio: 'ignore',
  })
} catch (e) {
  console.warn(
    `could not set core.hooksPath, pre-commit format hook is off: ${e}`,
  )
}
