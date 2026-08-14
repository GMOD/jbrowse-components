// `pnpm snapshots` — the CLI for the browser-test golden store.
//
// Deliberately three verbs where the figure CLI has seven. Goldens have no
// review page, no derived crops, no before/after report and no second bucket to
// mirror to: they are a local baseline for `test:browser`, and the only
// questions are "what have I got", "get me what the lock names" and "publish
// what I just regenerated". See snapshot-store.ts for why the bytes moved.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  diffManifests,
  fetchBlob,
  formatManifest,
  mapLimit,
  mergeManifest,
  parseManifest,
  storeBucket,
  storeKey,
  storeUrl,
} from '@jbrowse/browser-test-utils/blobStore'

import {
  MANIFEST_HEADER,
  lockPath,
  readLock,
  repoRoot,
  scanSnapshots,
  snapshotContentTypes,
  snapshotCorpus,
  snapshotName,
  storePrefix,
} from './snapshot-store.ts'

import type { BlobEntry } from '@jbrowse/browser-test-utils/blobStore'

const USAGE = `\
snapshots — the S3-backed browser-test golden store

  status              compare the worktree against snapshots.lock
  pull [--force]      install every golden snapshots.lock names
  push [--dry-run] [--filter a,b] [--exact]
                      upload new bytes, then rewrite snapshots.lock. --filter
                      scopes it to the goldens named and leaves every other
                      manifest line untouched

Golden names carry their backend: canvas2d/targeted_arcs-cloud.
`

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    filter: { type: 'string', multiple: true, default: [] },
    exact: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

function tokens(): string[] {
  return values.filter.flatMap(f => f.split(',')).filter(Boolean)
}

// Substring by default, whole-name under --exact. Its own tiny implementation
// rather than the website's `matchesFilterTokens`: that lives in a package this
// one does not depend on, and the rule is one line.
function matches(name: string, toks: string[]): boolean {
  return values.exact ? toks.includes(name) : toks.some(t => name.includes(t))
}

function readManifest(): Map<string, BlobEntry> {
  return parseManifest(readLock(), 'snapshots.lock')
}

function writeManifest(entries: Iterable<BlobEntry>) {
  fs.writeFileSync(lockPath, formatManifest([...entries], MANIFEST_HEADER))
}

// The three states a path can be in, which `status` prints and `pull` acts on.
function inspect(manifest: Map<string, BlobEntry>) {
  const disk = new Map(scanSnapshots().map(e => [e.path, e]))
  const missing: string[] = []
  const modified: string[] = []
  const ok: string[] = []
  for (const [p, entry] of manifest) {
    const d = disk.get(p)
    if (!d) {
      missing.push(p)
    } else if (d.sha256 !== entry.sha256) {
      modified.push(p)
    } else {
      ok.push(p)
    }
  }
  // On disk and in no manifest line: a golden a run just wrote that nobody has
  // published. Named rather than ignored — it is the thing `push` is for, and
  // silence here is how a new golden stays local forever.
  const untracked = [...disk.keys()].filter(p => !manifest.has(p))
  return { disk, missing, modified, ok, untracked }
}

function aws(argv: string[]): string {
  return execFileSync('aws', argv, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
}

// One listing rather than a HEAD per golden. If it fails (no credentials, an S3
// hiccup) upload everything instead of guessing — every upload writes bytes to
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
      `${storePrefix}/`,
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

function status() {
  const manifest = readManifest()
  const { missing, modified, ok, untracked } = inspect(manifest)
  console.log(`snapshots.lock names ${manifest.size} golden(s)`)
  console.log(`  ${ok.length} present and matching`)
  if (missing.length) {
    console.log(`  ${missing.length} missing — run \`pnpm snapshots pull\``)
  }
  if (modified.length) {
    console.log(`  ${modified.length} differ from the lock:`)
    for (const p of modified) {
      console.log(`    ${snapshotName(p)}`)
    }
  }
  if (untracked.length) {
    console.log(`  ${untracked.length} on disk and unpublished:`)
    for (const p of untracked) {
      console.log(`    ${snapshotName(p)}`)
    }
  }
}

// Whether the bytes on disk are already in the store — i.e. whether replacing
// them can lose anything.
async function isPublished(entry: BlobEntry): Promise<boolean> {
  try {
    return (await fetch(storeUrl(snapshotCorpus, entry), { method: 'HEAD' })).ok
  } catch {
    // Offline, or the store is unreachable. Treat as unpublished: the cost is
    // keeping a golden that did not need keeping, which is recoverable, against
    // overwriting one that did, which is not.
    return false
  }
}

async function pull() {
  const manifest = readManifest()
  if (!manifest.size) {
    console.log('snapshots.lock is empty; nothing to pull')
    return
  }
  const { disk, missing, modified, ok } = inspect(manifest)

  // "Differs from the lock" is two situations needing opposite handling, and
  // the store answers which is which exactly. A CHECKOUT left goldens from
  // another commit on disk: those bytes are published, so replacing them loses
  // nothing and not replacing them means comparing against another commit's
  // baseline. A REGEN you have not pushed exists nowhere else, and overwriting
  // it destroys work.
  const classified = await mapLimit(modified, 8, async p => ({
    path: p,
    published: await isPublished(disk.get(p)!),
  }))
  const stale = classified.filter(c => c.published).map(c => c.path)
  const precious = classified.filter(c => !c.published).map(c => c.path)
  const wanted = [...missing, ...(values.force ? modified : stale)]

  if (stale.length) {
    console.log(
      `replacing ${stale.length} golden(s) left by another commit (their bytes are in the store)`,
    )
  }
  if (precious.length && !values.force) {
    console.log(
      `keeping ${precious.length} golden(s) that exist only here — ` +
        '`pnpm snapshots push` to publish them, or --force to discard:',
    )
    for (const p of precious) {
      console.log(`  ${snapshotName(p)}`)
    }
  }
  if (!wanted.length) {
    console.log(`${ok.length} golden(s) already present`)
    return
  }

  console.log(`fetching ${wanted.length} golden(s) from the store…`)
  const errors: string[] = []
  let done = 0
  await mapLimit(wanted, 8, async p => {
    const entry = manifest.get(p)!
    try {
      const buf = await fetchBlob(snapshotCorpus, entry)
      const abs = path.join(repoRoot, p)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, buf)
      done++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  })
  console.log(`  ${done} golden(s) installed`)
  if (errors.length) {
    console.error(`\n${errors.length} golden(s) could not be fetched:`)
    for (const e of errors) {
      console.error(`  ${e}`)
    }
    process.exit(1)
  }
}

function push() {
  const dryRun = values['dry-run']
  const toks = tokens()
  const before = readManifest()
  const onDisk = scanSnapshots()
  if (!onDisk.length) {
    console.error(
      'no goldens on disk — refusing to write an empty snapshots.lock',
    )
    process.exit(1)
  }
  const selected = toks.length
    ? onDisk.filter(e => matches(snapshotName(e.path), toks))
    : onDisk
  if (toks.length) {
    console.log(
      `--filter ${toks.join(',')}: ${selected.length} golden(s) selected, ` +
        `${before.size - selected.filter(e => before.has(e.path)).length} lock line(s) left untouched`,
    )
    if (!selected.length) {
      console.error('nothing matched; refusing to rewrite the lock')
      process.exit(1)
    }
  }

  const after = mergeManifest(before, selected, toks, matches, snapshotName)
  const changes = diffManifests(before, after)
  if (!changes.length) {
    console.log('nothing moved; snapshots.lock is current')
    return
  }
  console.log(`${changes.length} manifest change(s)`)
  for (const c of changes.slice(0, 40)) {
    const e = c.after ?? c.before!
    console.log(
      `  ${c.kind === 'changed' ? '~' : c.kind === 'added' ? '+' : '-'} ${snapshotName(e.path)}`,
    )
  }
  if (changes.length > 40) {
    console.log(`  … and ${changes.length - 40} more`)
  }
  if (dryRun) {
    console.log('--dry-run: nothing uploaded, manifest not written')
    return
  }

  const have = readStoreKeys()
  const upload = selected.filter(e => !have?.has(storeKey(snapshotCorpus, e)))
  if (upload.length) {
    // Staged into the CAS layout so this is one `cp --recursive` per extension
    // rather than one `aws` process per golden — the CLI parallelizes
    // internally, and the 494-blob first push goes from minutes to seconds.
    // Hardlinked where the filesystem allows, so staging costs no bytes.
    const staging = path.join(repoRoot, 'node_modules/.cache/snapshot-store')
    fs.rmSync(staging, { recursive: true, force: true })
    const extensions = new Set<string>()
    for (const entry of upload) {
      const key = storeKey(snapshotCorpus, entry)
      const dest = path.join(staging, key.slice(storePrefix.length + 1))
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      const src = path.join(repoRoot, entry.path)
      try {
        fs.linkSync(src, dest)
      } catch {
        fs.copyFileSync(src, dest)
      }
      extensions.add(key.slice(key.lastIndexOf('.')))
    }
    for (const ext of [...extensions].sort()) {
      console.log(`uploading ${ext} blobs…`)
      aws([
        's3',
        'cp',
        staging,
        `${storeBucket}/${storePrefix}/`,
        '--recursive',
        '--exclude',
        '*',
        '--include',
        `*${ext}`,
        '--content-type',
        snapshotContentTypes[ext] ?? 'application/octet-stream',
        '--only-show-errors',
      ])
    }
    fs.rmSync(staging, { recursive: true, force: true })
  }
  console.log(`  ${upload.length} blob(s) uploaded`)
  writeManifest(after.values())
  console.log(`wrote snapshots.lock (${after.size} goldens)`)
  console.log('Commit it — that diff is the record of what moved.')
}

const cmd = positionals[0]
if (values.help || !cmd) {
  console.log(USAGE)
  process.exit(values.help ? 0 : 1)
}
if (cmd === 'status') {
  status()
} else if (cmd === 'pull') {
  await pull()
} else if (cmd === 'push') {
  push()
} else {
  console.error(`unknown command: ${cmd}\n`)
  console.log(USAGE)
  process.exit(1)
}
