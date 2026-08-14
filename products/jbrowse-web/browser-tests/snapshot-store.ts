// The browser-test golden store: golden BYTES live in S3, and git tracks only
// `snapshots.lock`.
//
// Why, measured 2026-08-14. `__snapshots__` is 494 goldens and 31 MB, and every
// render change rewrites a slice of it across three backends — 3,949 unique
// blob revisions over 156 commits since 2025-12-01. Those are undeltifiable
// binaries git keeps forever: 0.12 GiB of a 1.63 GiB pack, growing ~0.17 GiB/yr.
// It is a fifth of the figure problem (website/scripts/figure-store.ts) and it
// arrives the same way — one arc-colour change moved six of them in an
// afternoon.
//
// The addressing, the manifest grammar and the hash are
// `@jbrowse/browser-test-utils/blobStore`, shared with that store so a reader of
// one lock file can read the other. What is here is what is golden-SPECIFIC.
//
// WHAT MAKES THIS SAFER THAN IT SOUNDS: nothing shared reads these files. CI
// runs `test:browser:gate:ci`, which is `--gate-only` — it captures, feeds the
// cross-backend gate, and never opens a golden (see snapshotConfig.gateOnly).
// Goldens are environment-specific by construction, which snapshot.ts already
// says: a real-GPU webgl golden will not match a swiftshader capture. So the
// committed set is a LOCAL review baseline, not a gate, and moving the bytes out
// of git cannot break a check that was never reading them.
//
// The corollary is worth stating because it bounds what a `pull` is worth: the
// baseline you get is whatever machine last ran `--update-snapshots`. That is no
// worse than before — it is what git was carrying — but it is not a shared
// truth, and a diff against it is only meaningful if your renderer matches
// theirs. The canvas2d backend is software and byte-identical run to run, so its
// goldens do travel; webgl and webgpu do not.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  fetchBlob,
  hashBuffer,
  imageSize,
  mapLimit,
  parseManifest,
} from '@jbrowse/browser-test-utils/blobStore'

import type {
  BlobCorpus,
  BlobEntry,
} from '@jbrowse/browser-test-utils/blobStore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The repo root, four levels up from products/jbrowse-web/browser-tests.
export const repoRoot = path.resolve(__dirname, '../../..')

// Repo-relative, forward slashes — the one definition of where goldens live.
export const snapshotRoot = 'products/jbrowse-web/browser-tests/__snapshots__'

export const lockPath = path.join(
  repoRoot,
  'products/jbrowse-web/browser-tests/snapshots.lock',
)

export const snapshotExtRe = /\.(png|svg)$/i

export const snapshotContentTypes: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

export const storePrefix = 'jb2-snapshots'

// `jb2-snapshots/canvas2d/targeted_arcs-cloud.8e3bf6224f3c.png`. The name keeps
// the backend directory, because the same golden name exists under canvas2d,
// webgl and webgpu and they are three different pictures.
export function snapshotName(p: string): string {
  return p.replace(`${snapshotRoot}/`, '').replace(snapshotExtRe, '')
}

export const snapshotCorpus: BlobCorpus = {
  storePrefix,
  name: snapshotName,
  extRe: snapshotExtRe,
}

export const MANIFEST_HEADER = `\
# Browser-test golden manifest — the bytes live in S3, this file is what git
# tracks. See browser-tests/snapshot-store.ts for why, including the measurement.
#
# One line per golden, sorted by path, so a run that rewrites three goldens
# changes three lines. \`pnpm snapshots\` is the CLI; the test runner pulls what
# this file names before it compares anything.
#
# <path> <width>x<height> <bytes> <sha256>
`

// Transient output the runner writes INTO the golden tree, which is never a
// golden: the per-failure diff images and the cross-backend gate's evidence
// directory. Both are already gitignored, and this is the same list said again
// for the sweep — a store that hoovered them up would publish a failure artifact
// as a baseline.
export function isTransient(relFromRoot: string): boolean {
  const base = relFromRoot.slice(relFromRoot.lastIndexOf('/') + 1)
  return (
    relFromRoot.startsWith('backend-diffs/') ||
    base.endsWith('.diff.png') ||
    base.endsWith('.diff-visual.png') ||
    base.endsWith('.actual.png')
  )
}

// Every golden on disk, as manifest entries. Walks rather than globs so this
// module stays dependency-free.
export function scanSnapshots(): BlobEntry[] {
  const absRoot = path.join(repoRoot, snapshotRoot)
  if (!fs.existsSync(absRoot)) {
    return []
  }
  const out: BlobEntry[] = []
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        walk(abs)
        continue
      }
      const rel = path.relative(absRoot, abs).split(path.sep).join('/')
      if (!snapshotExtRe.test(rel) || isTransient(rel)) {
        continue
      }
      const buf = fs.readFileSync(abs)
      out.push({
        path: `${snapshotRoot}/${rel}`,
        sha256: hashBuffer(buf),
        bytes: buf.length,
        ...imageSize(buf),
      })
    }
  }
  walk(absRoot)
  return out
}

export function readLock(): string {
  return fs.existsSync(lockPath) ? fs.readFileSync(lockPath, 'utf8') : ''
}

// Install the goldens snapshots.lock names that are not on disk, and nothing
// else. The runner's own call, so a fresh clone can compare without anyone
// remembering `pnpm snapshots pull`.
//
// MISSING ONLY, deliberately: a golden whose bytes differ from the lock is
// either another commit's or an unpushed regen, and telling those apart takes a
// HEAD per file — that judgement belongs to the CLI's `pull`, which can explain
// itself and offers --force. A test run silently replacing a regen the reader
// had not pushed would destroy work to make a comparison prettier.
//
// Failures WARN rather than exit. The comparison degrades to "no baseline, write
// one" — which is what an absent golden already means to snapshot.ts — and a
// network blip should not stop someone running the tests offline.
export async function ensureGoldens(): Promise<void> {
  const manifest = parseManifest(readLock(), 'snapshots.lock')
  const missing = [...manifest.values()].filter(
    e => !fs.existsSync(path.join(repoRoot, e.path)),
  )
  if (!missing.length) {
    return
  }
  console.log(`Fetching ${missing.length} golden(s) from the store...`)
  let failed = 0
  await mapLimit(missing, 8, async entry => {
    try {
      const buf = await fetchBlob(snapshotCorpus, entry)
      const abs = path.join(repoRoot, entry.path)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, buf)
    } catch {
      failed++
    }
  })
  if (failed) {
    console.warn(
      `  ${failed} golden(s) could not be fetched; those comparisons will write a new baseline instead`,
    )
  }
}
