import { execFileSync } from 'node:child_process'
import { mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Extract one workspace package at a git ref into a temp directory the running
 * node can actually import from, and return the directory.
 *
 * The whole package, not the file under test: a baseline that reached back into
 * the working tree for its own package's helpers would be a chimera of both
 * revisions, and those helpers are exactly what a change like this tends to
 * move around.
 *
 * **The symlink is what makes the extraction importable at all**, and leaving it
 * out is a trap with no partial failure mode. A bare `git archive` into `/tmp`
 * has no `node_modules` anywhere above it, so the first cross-package import the
 * baseline reaches — `@jbrowse/core`, `@jbrowse/alignments-core` — throws
 * `ERR_MODULE_NOT_FOUND` and the bench produces no numbers whatsoever. It is
 * silent until the day the module under test grows its first import out of its
 * own package: `mafCoverage.bench.ts` ran for months and then stopped, when
 * `positionOrder` moved into `@jbrowse/alignments-core`, and read as a broken
 * bench rather than a broken harness.
 *
 * Linking the *package's own* `node_modules` rather than the root's is what pnpm
 * requires here — the workspace links live per package, and the root has only
 * the root's own devDependencies. Those links are relative to the directory the
 * symlink points at, not to the symlink, so `@jbrowse/core` resolves to the real
 * `packages/core` and the baseline gets the working tree's copy of every
 * cross-package dependency. That is correct rather than a compromise: the A/B is
 * over this package, and pinning its dependencies to the same revision on both
 * sides is what keeps the comparison about the change.
 */
export function checkoutPackageAtRef(
  root: string,
  ref: string,
  pkg = 'plugins/maf',
) {
  const dir = mkdtempSync(join(tmpdir(), 'jb-bench-'))
  const tar = execFileSync('git', ['archive', ref, '--', pkg], {
    cwd: root,
    maxBuffer: 1 << 28,
    encoding: 'buffer',
  })
  execFileSync('tar', ['-x', '-C', dir], { input: tar })
  symlinkSync(join(root, pkg, 'node_modules'), join(dir, pkg, 'node_modules'))
  return dir
}
