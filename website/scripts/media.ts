// CLI for the media store — the third corpus in the content-addressed blob store
// (@jbrowse/browser-test-utils/blobStore), beside the website's figures and the
// browser-test goldens.
//
//   pnpm media status          what the worktree and media.lock disagree about
//   pnpm media:pull            install every file the manifest names (no credentials)
//   pnpm media:push            upload new bytes, rewrite media.lock (needs AWS)
//   pnpm media check           CI gate: manifest and worktree agree
//
// WHY A STORE AT ALL, when the docs deploy already publishes `static/`.
//
// `update-docs.yml` runs `rclone sync dist/ s3:jbrowse.org/jb2`, and sync
// DELETES anything in the bucket that the freshly-built `dist/` does not carry.
// The bytes cannot be committed (a screencast is an undeltifiable blob git keeps
// forever, and re-filming the same tour produces different bytes every time), so
// a CI checkout has no `static/media` and the sync would delete the videos on
// the first docs push after they landed. `pnpm build` runs `media:pull`, so the
// files are there when astro copies `static/` in, and the sync finds them.
//
// The alternative was regenerating them in the docs CI — a jbrowse-web build
// plus a headless capture on every "update docs" commit, for output that is
// non-deterministic and so re-uploads in full each time.
//
// The store's three properties are the figures': content-addressed so a key is
// never overwritten, immutable so an old revision stays fetchable at its own
// url, and public so `pull` needs no credentials. website/scripts/
// figure-store.ts is where they are argued at length.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'

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

const usage = `media — the S3-backed media store

  status              compare the worktree against website/media.lock
  pull [--force]      install every file media.lock names
  push [--dry-run] [--filter a,b]
                      upload new bytes, then rewrite media.lock
  check               fail if the manifest and the worktree disagree
`

const { values, positionals } = (() => {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h', default: false },
        filter: { type: 'string', multiple: true },
        'dry-run': { type: 'boolean', default: false },
        force: { type: 'boolean', default: false },
      },
    })
  } catch (e) {
    console.error(`${e instanceof Error ? e.message : String(e)}\n\n${usage}`)
    process.exit(1)
  }
})()

const name = (p: string) => mediaCorpus.name(p)

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

function status() {
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

async function pull() {
  const manifest = readManifest()
  const state = inspect(manifest)
  // A worktree file that differs from the manifest is either another commit's
  // (its bytes are in the store, so replacing it loses nothing) or a re-film
  // nobody has pushed (its bytes exist here and nowhere else). Without the
  // store to ask, the two are indistinguishable — so this keeps them and says
  // so, and --force is how you throw one away on purpose.
  const wanted = [...state.missing, ...(values.force ? state.modified : [])]
  if (state.modified.length && !values.force) {
    console.log(
      `keeping ${state.modified.length} media file(s) that differ from media.lock — ` +
        '`pnpm media:push` to publish them, or --force to discard',
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

function push() {
  const before = readManifest()
  const tokens = parseFilterTokens(values.filter)
  const selected = listMediaFiles()
    .filter(p => matchesFilterTokens(name(p), tokens, false))
    .map(describeFile)
  const existing = readStoreKeys()
  const toUpload = selected.filter(
    e => !existing?.has(storeKey(mediaCorpus, e)),
  )
  for (const entry of toUpload) {
    console.log(`  ${storeUrl(mediaCorpus, entry)}`)
  }
  if (values['dry-run']) {
    console.log(`${toUpload.length} blob(s) would be uploaded`)
    return
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
  const after = mergeManifest(
    before,
    selected,
    tokens,
    (n, t) => matchesFilterTokens(n, t, false),
    name,
  )
  writeFileSync(
    manifestPath,
    formatManifest([...after.values()], MANIFEST_HEADER),
  )
  const changes = diffManifests(before, after)
  console.log(
    `${toUpload.length} blob(s) uploaded, ${changes.length} manifest change(s)`,
  )
}

function check() {
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
    process.exit(1)
  }
  console.log(`${state.ok.length} media file(s) match media.lock`)
}

const command = positionals[0] ?? 'status'
if (values.help) {
  console.log(usage)
} else if (command === 'status') {
  status()
} else if (command === 'pull') {
  await pull()
} else if (command === 'push') {
  push()
} else if (command === 'check') {
  check()
} else {
  console.error(`unknown command: ${command}\n\n${usage}`)
  process.exit(1)
}
