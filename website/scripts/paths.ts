// The handful of directories every generator and validator in here used to
// re-derive for itself. Node-only, and now free of `import.meta` (see the walk
// below), which is what made it safe to import from the bundled `src/` side as
// well as from scripts/.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

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
export const distDir = join(websiteDir, 'dist')

// A doc's path relative to website/docs ("tutorials/foo.md") — the form every
// validator reports a problem against and prefix-matches the generated
// directories on.
export function docRelative(file: string): string {
  return file.slice(docsDir.length + 1)
}
