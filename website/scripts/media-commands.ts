// The media store's four commands, as functions rather than as a CLI.
//
// They were the body of scripts/media.ts, and they moved here so figures.ts can
// run them: a regen produces figures and clips together, and remembering two
// pushes is the kind of thing that gets remembered until it doesn't. `pnpm
// figures:push` now covers both stores and `pnpm media` stays the media-only
// door, which is the same split figure-store.ts and figures.ts already have.
//
// Every one takes its options rather than reading a parsed argv, because there
// are now two argv shapes reaching them.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  diffManifests,
  fetchBlob,
  formatManifest,
  mapLimit,
  mergeManifest,
  storeBucket,
  storeKey,
  storeUrl,
} from '@jbrowse/browser-test-utils/blobStore'

import { matchesFilterTokens, parseFilterTokens } from './filter-tokens.ts'
import {
  MANIFEST_HEADER,
  contentTypes,
  describeFile,
  listMediaFiles,
  manifestPath,
  mediaCorpus,
  mediaExtRe,
  readManifest,
  shortName,
} from './media-store.ts'
import { repoRoot } from './paths.ts'

import type { BlobEntry } from '@jbrowse/browser-test-utils/blobStore'

// A year, immutable: the url names the bytes, so it can never be wrong.
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

const name = (p: string) => mediaCorpus.name(p)

export interface MediaOptions {
  filter?: string[]
  exact?: boolean
  dryRun?: boolean
  force?: boolean
  allowDeletions?: boolean
}

function inspect(manifest: Map<string, BlobEntry>) {
  const onDisk = new Map(listMediaFiles().map(p => [p, describeFile(p)]))
  const missing: string[] = []
  const modified: string[] = []
  const ok: string[] = []
  for (const [path, entry] of manifest) {
    const found = onDisk.get(path)
    if (!found) {
      missing.push(path)
    } else if (found.sha256 === entry.sha256) {
      ok.push(path)
    } else {
      modified.push(path)
    }
  }
  const unpublished = [...onDisk.keys()].filter(p => !manifest.has(p))
  return { onDisk, missing, modified, ok, unpublished }
}

export function mediaStatus() {
  const manifest = readManifest()
  const state = inspect(manifest)
  console.log(`${state.ok.length} media file(s) match media.lock`)
  for (const [label, list] of [
    ['missing (pull)', state.missing],
    ['differs from the manifest', state.modified],
    ['on disk, not in the manifest (push)', state.unpublished],
  ] as const) {
    if (list.length) {
      console.log(`\n${list.length} ${label}:`)
      for (const p of list) {
        console.log(`  ${shortName(p)}`)
      }
    }
  }
}

export async function mediaPull({ force }: MediaOptions = {}) {
  const manifest = readManifest()
  const state = inspect(manifest)
  // A worktree file that differs from the manifest is either another commit's
  // (its bytes are in the store, so replacing it loses nothing) or a re-film
  // nobody has pushed (its bytes exist here and nowhere else). Without the
  // store to ask, the two are indistinguishable — so this keeps them and says
  // so, and --force is how you throw one away on purpose.
  const wanted = [...state.missing, ...(force ? state.modified : [])]
  if (state.modified.length && !force) {
    console.log(
      `keeping ${state.modified.length} media file(s) that differ from media.lock — ` +
        '`pnpm figures:push` to publish them, or --force to discard',
    )
  }
  if (!wanted.length) {
    console.log(`${state.ok.length} media file(s) already present`)
    return
  }
  console.log(`fetching ${wanted.length} media file(s) from the store…`)
  const errors: string[] = []
  await mapLimit(wanted, 6, async path => {
    try {
      const buf = await fetchBlob(mediaCorpus, manifest.get(path)!)
      const abs = join(repoRoot, path)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, buf)
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  })
  console.log(`  ${wanted.length - errors.length} installed`)
  if (errors.length) {
    console.error(`\n${errors.length} could not be fetched:`)
    for (const e of errors) {
      console.error(`  ${e}`)
    }
    process.exit(1)
  }
}

function aws(argv: string[]) {
  return execFileSync('aws', argv, { encoding: 'utf8', maxBuffer: 1 << 26 })
}

// One listing rather than a HEAD per file. If it fails (no credentials, an S3
// hiccup) upload everything instead of guessing: every upload writes bytes to
// the key that names them, so a redundant one costs a transfer and changes
// nothing.
function readStoreKeys(): Set<string> | undefined {
  try {
    const out = aws([
      's3api',
      'list-objects-v2',
      '--bucket',
      storeBucket.replace('s3://', ''),
      '--prefix',
      `${mediaCorpus.storePrefix}/`,
      '--query',
      'Contents[].Key',
      '--output',
      'text',
    ])
    return new Set(out.split(/\s+/).filter(k => k && k !== 'None'))
  } catch {
    console.log('could not list the store; uploading every blob')
    return undefined
  }
}

/**
 * Returns how many files the selection matched, so a caller driving both stores
 * can decide what "matched nothing" means. `-1` says the corpus was skipped
 * because there is nothing on disk at all.
 */
export function mediaPush({
  filter,
  exact,
  dryRun,
  allowDeletions,
}: MediaOptions = {}): number {
  // --exact has to reach here as well. One command drives both stores, so a
  // filter tightened for the figure half but left substring-wide here selects
  // clips the run never named, and tightening the filter is exactly what a
  // shared worktree is told to do.
  const matches = (n: string, tokens: string[]) =>
    matchesFilterTokens(n, tokens, !!exact)
  const before = readManifest()
  const tokens = parseFilterTokens(filter)
  const onDisk = listMediaFiles()

  // NOTHING ON DISK IS THE NORMAL STATE, not a request to unpublish. `pnpm
  // build` pulls media, a bare checkout does not, and CI's weekly figure sweep
  // renders stills and films nothing — so the corpus is empty in more runs than
  // it is full. An unfiltered mergeManifest over an empty selection returns an
  // empty map, so without this the sweep's `figures:push` would blank
  // media.lock, the bytes would stay in the store unreferenced, and every clip
  // would simply stop being installed with no fetch failing anywhere.
  //
  // The figure store has had this guard since it was written; this one is the
  // same hole in the smaller corpus, reachable today by `pnpm media:push` in a
  // checkout that never pulled.
  //
  // --allow-deletions does NOT open it, which is the figure half's posture too.
  // The flag scopes per-file removals inside a corpus you actually have, and one
  // command now drives two stores — so `figures:push --allow-deletions` to
  // retire one figure must not empty a media store this checkout never pulled.
  // Unpublishing every clip at once is a manifest edit, not a flag.
  if (!onDisk.length) {
    console.log(
      'no media on disk — skipping the media store.\n' +
        '  `pnpm figures:pull` first if you meant to update a clip.',
    )
    return -1
  }

  const selected = onDisk
    .filter(p => matches(name(p), tokens))
    .map(describeFile)
  if (!selected.length && tokens.length) {
    return 0
  }
  const after = mergeManifest(before, selected, tokens, matches, name)
  const changes = diffManifests(before, after)

  // The one change this cannot undo, so it is the one that has to be asked for
  // — the same rule, and the same reasoning, as the figure store's.
  const removals = changes.filter(c => c.kind === 'removed')
  // Named, not counted. The figure half prints a report of what moved; this one
  // printed "N media.lock change(s)", so an unpublish read the same as an
  // upload and the one irreversible change was the invisible one.
  if (removals.length && allowDeletions) {
    console.log(`dropping ${removals.length} media file(s) from media.lock:`)
    for (const c of removals) {
      console.log(`  - ${shortName(c.path)}`)
    }
  }
  if (removals.length && !allowDeletions) {
    console.error(
      `refusing to drop ${removals.length} media file(s) from media.lock:\n` +
        `${removals.map(c => `  - ${shortName(c.path)}`).join('\n')}\n\n` +
        'Their bytes are in the store; only the manifest line would go, and nothing downstream would report them missing.\n' +
        'If this worktree is incomplete, `pnpm figures:pull` first.\n' +
        'If you really mean to unpublish them, re-run with --allow-deletions.',
    )
    process.exit(1)
  }

  const existing = readStoreKeys()
  const toUpload = selected.filter(
    e => !existing?.has(storeKey(mediaCorpus, e)),
  )
  for (const entry of toUpload) {
    console.log(`  ${storeUrl(mediaCorpus, entry)}`)
  }
  if (dryRun) {
    console.log(`${toUpload.length} media blob(s) would be uploaded`)
    return selected.length
  }
  // Bytes BEFORE the manifest, always: a manifest line whose blob was never
  // pushed breaks `pull` for everyone else.
  for (const entry of toUpload) {
    const ext = mediaExtRe.exec(entry.path)![0].toLowerCase()
    aws([
      's3',
      'cp',
      join(repoRoot, entry.path),
      `${storeBucket}/${storeKey(mediaCorpus, entry)}`,
      '--content-type',
      contentTypes[ext] ?? 'application/octet-stream',
      '--cache-control',
      CACHE_CONTROL,
      '--only-show-errors',
    ])
  }
  const next = formatManifest([...after.values()], MANIFEST_HEADER)
  if (readFileSync(manifestPath, 'utf8') === next) {
    console.log(
      `${toUpload.length} media blob(s) uploaded, media.lock already matches`,
    )
    return selected.length
  }
  writeFileSync(manifestPath, next)
  console.log(
    `${toUpload.length} media blob(s) uploaded, ${changes.length} media.lock change(s)`,
  )
  return selected.length
}

/** Reports rather than exits, so a combined run says what BOTH stores think. */
export function mediaCheck(): boolean {
  const manifest = readManifest()
  const state = inspect(manifest)
  const problems = [
    ...state.missing.map(p => `missing: ${shortName(p)}`),
    ...state.modified.map(p => `differs from media.lock: ${shortName(p)}`),
    ...state.unpublished.map(p => `not in media.lock: ${shortName(p)}`),
  ]
  if (problems.length) {
    console.error('media.lock and the worktree disagree:')
    for (const p of problems) {
      console.error(`  ${p}`)
    }
    return false
  }
  console.log(`${state.ok.length} media file(s) match media.lock`)
  return true
}
