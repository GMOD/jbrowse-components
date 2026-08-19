// The handful of directories every generator and validator in here used to
// re-derive for itself. Node-only, and now free of `import.meta` (see the walk
// below), which is what made it safe to import from the bundled `src/` side as
// well as from scripts/.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'

// The workspace root, found by walking up from the process's working directory
// for the marker only the root carries, NOT derived from this module's own
// location.
//
// `join(import.meta.dirname, '..', '..')` is the obvious version and is correct
// whenever the module is loaded from source, which is how everything in
// scripts/ loads it. It is wrong the moment Astro bundles a module that imports
// this one into `website/dist/.prerender/chunks/`, because the walk then starts
// three directories deeper in a different tree and lands on `website/`.
//
// That is not hypothetical, and the two ways it went wrong are both worth
// knowing. A module-scope config read in `specs/scrna.ts` took `astro build`
// down with ENOENT on `website/test_data/…` — loudly, but only in the build,
// since `astro dev` loads the same module from source and resolves it fine. And
// the walk in `src/lib/spec-recipe/configs.ts` came out right in the bundle only
// because it happened to be one level longer than the chunk directory is deep,
// which is luck rather than a design and would have broken silently (its read is
// wrapped in a try/catch) the next time Astro moved its output.
//
// cwd survives bundling. Every entry point here — astro, the generators, the
// validators — runs with it inside the workspace, whether that is website/ (the
// package scripts) or the root (`node website/scripts/…`).
function findRepoRoot() {
  let dir = process.cwd()
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(
        `no pnpm-workspace.yaml above ${process.cwd()}: website scripts have to run with the working directory inside the repo`,
      )
    }
    dir = parent
  }
}

export const repoRoot = findRepoRoot()
export const websiteDir = join(repoRoot, 'website')
export const docsDir = join(websiteDir, 'docs')
// The pending release announcement drafts. A draft is a public page that has
// not been published yet, so the generators that keep a doc's figures honest
// have to reach it: by the time `pnpm release` renders one it is committed,
// tagged and pushed in the same run, and every number in it is live.
export const releaseDraftsDir = join(websiteDir, 'release_announcement_drafts')
export const distDir = join(websiteDir, 'dist')
// Where a capture that failed dumps the frame it failed on. OUTSIDE static/, not
// next to the figure it failed on: astro.config sets `publicDir: './static'`,
// and Astro copies that directory verbatim without consulting .gitignore — so a
// debug dump under static/img is kept out of git and then published anyway,
// which `deploy_staging.sh` (it builds from the working tree) uploads. One stray
// dump was 3.2 MB.
//
// Here rather than in screenshot-options.ts, which parses process.argv when it
// is imported: the dump is written by screenshot-asserts.ts, which the video
// generator's readiness stack reaches too, and that CLI's own flags are not the
// screenshot run's.
export const debugDir = join(websiteDir, 'debug-screenshots')

// The checkout the sibling repositories sit beside, which is the PRIMARY one
// even when this code runs from a worktree. `repoRoot` above answers "which tree
// am I in", and for anything outside the tree that is the wrong question:
// `join(repoRoot, '..')` is `.claude/worktrees/` in a worktree session, so a
// path built from it looks for `.claude/worktrees/jb2plugins` and finds nothing.
//
// What that cost: `check-menu-labels` reads the graph and protein-3D plugins'
// `src/` for the labels those pages name, skips a page whose plugin checkout is
// absent, and exits 0 — so from every agent worktree it silently skipped five
// pages, including the three pangenome tutorials, while reporting success. A
// check that covers less than it says is worse than one that fails.
//
// `<root>/.git` is a directory in the primary checkout and a FILE in a worktree,
// holding `gitdir: <primary>/.git/worktrees/<name>`. That is the link back, and
// it needs no subprocess. Anything unexpected (no git, an unreadable pointer, a
// gitdir that is not under `worktrees/`) falls back to `repoRoot`, which is the
// answer for a plain checkout anyway.
function findPrimaryRepoRoot() {
  const dotGit = join(repoRoot, '.git')
  if (!existsSync(dotGit) || statSync(dotGit).isDirectory()) {
    return repoRoot
  }
  const pointer = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))
  if (!pointer) {
    return repoRoot
  }
  // git may write this relative to the worktree (`--relative-paths`)
  const gitDir = isAbsolute(pointer[1]!.trim())
    ? pointer[1]!.trim()
    : resolve(repoRoot, pointer[1]!.trim())
  const marker = `${sep}.git${sep}worktrees${sep}`
  const cut = gitDir.indexOf(marker)
  return cut === -1 ? repoRoot : gitDir.slice(0, cut)
}

export const primaryRepoRoot = findPrimaryRepoRoot()

// A JBrowse plugin developed in its own repo, checked out beside this one. The
// two readers are `check-menu-labels` (its `src/`, for the labels the docs name)
// and `specs/graph-fixtures.ts` (its `dist/`, under GRAPH_PLUGIN_LOCAL), so the
// `jb2plugins` directory and the `jbrowse-plugin-` prefix are written once.
export function pluginCheckout(name: string) {
  return join(primaryRepoRoot, '..', 'jb2plugins', `jbrowse-plugin-${name}`)
}

// A doc's path relative to website/docs ("tutorials/foo.md") — the form every
// validator reports a problem against and prefix-matches the generated
// directories on.
export function docRelative(file: string): string {
  return file.slice(docsDir.length + 1)
}
