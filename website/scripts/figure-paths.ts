// The filesystem half of the figure store — everything figure-store.ts cannot
// hold because jest transforms that module to CJS, which cannot parse
// `import.meta`. Same split, same reason, as check-utils.ts vs paths.ts.
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

import {
  type FigureEntry,
  figureExtRe,
  figureName,
  figureRoots,
  hashBuffer,
  imageSize,
  isExcluded,
  parseManifest,
  storeKey,
  storePrefix,
  storeUrl,
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
        } else if (figureExtRe.test(entry.name) && !isExcluded(rel, root)) {
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

// Every figure on disk, hashed, keyed by repo-relative path.
//
// One pass. Hashing the whole set is 62 MB of reads and the single most
// expensive thing any of these tools does, so a caller that wants both "what
// disagrees with the manifest" and "what is the hash of this one figure" must
// be able to ask once — see the review server, which used to pay for three
// separate sweeps to answer one page load.
export function describeWorktree(): Map<string, FigureEntry> {
  return new Map(listFigureFiles().map(p => [p, describeFile(p)]))
}

export function fileExists(relPath: string): boolean {
  try {
    return statSync(join(repoRoot, relPath)).isFile()
  } catch {
    return false
  }
}

// Whether this worktree holds any of the figures figures.lock puts under
// `root`. False is the state of a fresh clone or a `git worktree add` — the
// bytes are gitignored and arrive via `pnpm figures:pull` — rather than
// anything wrong, which is why a tool that reads figures can treat it as
// "nothing to check here" instead of as a failure.
//
// Deliberately all-or-nothing: one figure present means the corpus IS
// installed, so a single absent file there is a real disagreement with the
// manifest and stays the caller's problem. A root the manifest lists nothing
// under is vacuously satisfied.
export function figureRootPulled(root: string): boolean {
  const listed = [...readManifest().keys()].filter(p =>
    p.startsWith(`${root}/`),
  )
  return listed.length === 0 || listed.some(fileExists)
}

// figures.lock as of a git ref — the tracked baseline a branch is reviewed
// against, now that figure bytes themselves are gitignored and `git diff` over
// static/img has nothing to say about them.
//
// undefined, not an empty map, when there is no manifest at that ref: it either
// predates the store or the ref is unknown, and those want different words from
// each caller rather than a silent "everything is new".
export function manifestAt(ref: string): Map<string, FigureEntry> | undefined {
  try {
    return parseManifest(
      execFileSync('git', ['show', `${ref}:figures.lock`], {
        encoding: 'utf8',
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 64 * 1024 * 1024,
      }),
    )
  } catch {
    return undefined
  }
}

// One figure's bytes from the store, hash-verified, cached under
// node_modules/.cache forever.
//
// "Forever" is exact rather than optimistic: the key is derived from the bytes,
// so a cached blob that hashes right IS the blob and no revalidation is
// possible or needed. That is also why the verify is not optional — a truncated
// transfer is the only way the URL can answer with something else, and writing
// it to the cache would poison every later read.
//
// Lives here rather than in the pull command because it is not about pulling: a
// content-addressed store URL is the only way to see a figure's PREVIOUS
// revision, so anything that compares against a baseline (figures report,
// triage-figure-diffs) needs the same fetch, the same cache and the same
// verification.
export async function fetchBlob(entry: FigureEntry): Promise<Buffer> {
  const cached = join(cacheDir, storeKey(entry).slice(storePrefix.length + 1))
  try {
    const buf = readFileSync(cached)
    if (hashBuffer(buf) === entry.sha256) {
      return buf
    }
  } catch {
    // not cached, or cached corrupt — refetch
  }
  const url = storeUrl(entry)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `${figureName(entry.path)}: ${res.status} fetching ${url}\n` +
        '    Its bytes were never pushed to the store. Whoever committed this ' +
        'figures.lock line must run `pnpm figures:push`.',
    )
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const got = hashBuffer(buf)
  if (got !== entry.sha256) {
    // Only reachable through a truncated transfer or a tampered object: the URL
    // is derived from the hash, so the store cannot legitimately answer with
    // anything else.
    throw new Error(
      `${figureName(entry.path)}: ${url} hashes to ${got.slice(0, 12)}, expected ${entry.sha256.slice(0, 12)}`,
    )
  }
  mkdirSync(dirname(cached), { recursive: true })
  writeFileSync(cached, buf)
  return buf
}

// The commit a ref currently names, and when it was authored.
//
// For saying which baseline a comparison is actually against. A remote-tracking
// ref is only as fresh as the last fetch, so `origin/main` on a machine that has
// not fetched in a week is a week-old baseline that still calls itself "main" —
// invisible unless something names the commit. Empty when the ref is unknown,
// which is the same condition manifestAt reports as undefined.
export function describeRef(ref: string): { commit?: string; date?: string } {
  try {
    const [commit, date] = execFileSync(
      'git',
      ['log', '-1', '--format=%h%n%cI', ref],
      { encoding: 'utf8', cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .trim()
      .split('\n')
    return commit && date ? { commit, date } : {}
  } catch {
    return {}
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
export function inspectWorktree(
  manifest = readManifest(),
  onDisk = describeWorktree(),
): WorktreeState {
  const state: WorktreeState = {
    ok: [],
    modified: [],
    untracked: [],
    missing: [],
  }
  for (const [path, file] of onDisk) {
    const entry = manifest.get(path)
    if (!entry) {
      state.untracked.push(path)
    } else if (file.sha256 === entry.sha256) {
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
export function unpublishedFigures(state = inspectWorktree()) {
  return [...state.modified, ...state.untracked].sort()
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
