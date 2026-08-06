// The filesystem half of the figure store — everything figure-store.ts cannot
// hold because jest transforms that module to CJS, which cannot parse
// `import.meta`. Same split, same reason, as check-utils.ts vs paths.ts.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import {
  type FigureEntry,
  figureExtRe,
  figureRoots,
  hashBuffer,
  imageSize,
  isExcluded,
  parseManifest,
} from './figure-store.ts'

export const repoRoot = join(import.meta.dirname, '..', '..')

// Tracked at the repo root, not under website/, because it spans two products.
export const manifestPath = join(repoRoot, 'figures.lock')

// Content-addressed, so a blob fetched once is a blob forever. Living under
// node_modules/.cache means switching branches reinstalls figures from disk
// rather than from the network, and `rm -rf node_modules` is already the
// understood way to throw local caches away.
export const cacheDir = join(
  repoRoot,
  'node_modules',
  '.cache',
  'jbrowse-figures',
)

// Every figure on disk, repo-relative and sorted. A missing root is not an
// error: it is the state of a fresh clone, and this module is also the thing
// that repopulates it.
export function listFigureFiles(): string[] {
  const out: string[] = []
  for (const root of figureRoots) {
    const walk = (dir: string, prefix: string) => {
      let entries
      try {
        entries = readdirSync(join(repoRoot, dir), { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          walk(`${dir}/${entry.name}`, rel)
        } else if (figureExtRe.test(entry.name) && !isExcluded(rel)) {
          out.push(`${root}/${rel}`)
        }
      }
    }
    walk(root, '')
  }
  return out.sort()
}

// Reads whole files rather than streaming: the largest figure is ~5 MB and the
// whole set is 62 MB, so a scan is one pass of readFileSync and not worth the
// async machinery.
export function describeFile(relPath: string): FigureEntry {
  const buf = readFileSync(join(repoRoot, relPath))
  return {
    path: relPath,
    sha256: hashBuffer(buf),
    bytes: buf.length,
    ...imageSize(buf),
  }
}

export function fileExists(relPath: string): boolean {
  try {
    return statSync(join(repoRoot, relPath)).isFile()
  } catch {
    return false
  }
}

export interface WorktreeState {
  ok: string[]
  // On disk, hash differs from the manifest — a regen not pushed yet.
  modified: string[]
  // On disk, absent from the manifest — a brand-new figure.
  untracked: string[]
  // In the manifest, absent from disk — you have not pulled.
  missing: string[]
}

// What the worktree and figures.lock disagree about.
//
// `modified` and `untracked` together are the one thing this arrangement made
// easy to miss. While figure bytes were tracked, a regen you forgot to commit
// sat in `git status` where nobody could miss it; gitignored, it is invisible,
// and the next `pull` on any other machine quietly serves the old image. CI
// cannot help — the evidence is a file on your disk that never reaches a
// runner — so the report has to happen where the figures are made and reviewed.
// generate-screenshots.ts ends on it and review-screenshots-web.ts shows it.
//
// Deliberately the whole worktree rather than just this run's output: the case
// worth catching is the figure you regenerated last week, and a --filter run
// today should still say so.
export function inspectWorktree(manifest = readManifest()): WorktreeState {
  const state: WorktreeState = {
    ok: [],
    modified: [],
    untracked: [],
    missing: [],
  }
  const onDisk = new Set(listFigureFiles())
  for (const path of onDisk) {
    const entry = manifest.get(path)
    if (!entry) {
      state.untracked.push(path)
    } else if (describeFile(path).sha256 === entry.sha256) {
      state.ok.push(path)
    } else {
      state.modified.push(path)
    }
  }
  for (const path of manifest.keys()) {
    if (!onDisk.has(path)) {
      state.missing.push(path)
    }
  }
  return state
}

// The figures whose bytes exist only on this machine. Empty means everything
// you can see locally is also what everyone else and the published site get.
export function unpublishedFigures(manifest?: Map<string, FigureEntry>) {
  const { modified, untracked } = inspectWorktree(manifest)
  return [...modified, ...untracked].sort()
}

export function readManifest(): Map<string, FigureEntry> {
  try {
    return parseManifest(readFileSync(manifestPath, 'utf8'))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Map()
    }
    throw e
  }
}
