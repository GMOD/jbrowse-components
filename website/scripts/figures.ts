// CLI for the figure store. See figure-store.ts for what the store is and why.
//
//   pnpm figures status              what the worktree and figures.lock disagree about
//   pnpm figures:pull                fetch every figure the manifest names (no credentials)
//   pnpm figures:push                upload new bytes, rewrite figures.lock (needs AWS)
//   pnpm figures:check               CI gate: manifest and worktree agree
//   pnpm figures:report              what moved, with before/after images
//
// Order matters in exactly one place: `push` uploads bytes BEFORE it rewrites
// the manifest, because a manifest line whose blob was never pushed breaks
// `pull` for everyone else. `check --remote` is the backstop for that.
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  linkSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

import {
  type WorktreeState,
  cacheDir,
  describeFile,
  inspectWorktree,
  listFigureFiles,
  manifestAt,
  manifestPath,
  readManifest,
  repoRoot,
  unpublishedFigures,
} from './figure-paths.ts'
import {
  type FigureEntry,
  diffManifests,
  figureName,
  formatManifest,
  formatMarkdownReport,
  formatTextReport,
  hashBuffer,
  resolveNow,
  storeBucket,
  storeKey,
  storePrefix,
  storeUrl,
} from './figure-store.ts'

const args = process.argv.slice(2)
const command = args[0] ?? 'status'
const flag = (name: string) => args.includes(`--${name}`)
const option = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

// A year, immutable: the URL names the bytes, so it can never be wrong.
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!)
      }
    }),
  )
  return out
}

// ---------------------------------------------------------------------------
// what the worktree and the manifest disagree about
// ---------------------------------------------------------------------------

function reportWorktree(state: WorktreeState) {
  const list = (label: string, paths: string[], hint: string) => {
    if (paths.length) {
      console.log(`\n${paths.length} ${label} (${hint}):`)
      for (const p of paths) {
        console.log(`  ${figureName(p)}`)
      }
    }
  }
  console.log(`${state.ok.length} figure(s) match figures.lock`)
  list('modified', state.modified, 'regenerated locally — `pnpm figures:push`')
  list('new', state.untracked, 'not in the manifest — `pnpm figures:push`')
  list('missing', state.missing, 'not on disk — `pnpm figures:pull`')
}

// ---------------------------------------------------------------------------
// pull
// ---------------------------------------------------------------------------

async function fetchBlob(entry: FigureEntry): Promise<Buffer> {
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

// Whether the bytes currently on disk are in the store — i.e. whether replacing
// them can lose anything. One HEAD per file, but only ever for files that
// already differ from the manifest, which is normally a handful.
async function isPublished(path: string, sha256: string): Promise<boolean> {
  try {
    return (await fetch(storeUrl({ path, sha256 }), { method: 'HEAD' })).ok
  } catch {
    // Offline, or the store is unreachable. Treat as unpublished: the cost is
    // keeping a figure that did not need keeping, which is recoverable, versus
    // overwriting one that did, which is not.
    return false
  }
}

async function pull() {
  const manifest = readManifest()
  const force = flag('force')
  const state = inspectWorktree(manifest)

  // "Differs from the manifest" is two situations that need opposite handling,
  // and telling them apart is what makes this safe to run from `pnpm build`.
  //
  // A CHECKOUT left figures from another commit on disk. Those bytes are in the
  // store, so replacing them loses nothing and NOT replacing them is the bug:
  // the build would publish a figure belonging to a different commit, silently.
  // Refusing to touch these is what the naive version did, and switching
  // branches is far commoner than hand-editing a figure.
  //
  // A REGEN you have not pushed is bytes that exist nowhere else. Overwriting
  // those destroys work, and no amount of convenience justifies it.
  //
  // The store answers which is which, exactly: published bytes are recoverable
  // forever at their own immutable URL, unpublished bytes are not.
  const classified = await mapLimit(state.modified, 8, async path => ({
    path,
    published: await isPublished(path, describeFile(path).sha256),
  }))
  const stale = classified.filter(c => c.published).map(c => c.path)
  const precious = classified.filter(c => !c.published).map(c => c.path)
  const wanted = [...state.missing, ...(force ? state.modified : stale)]

  if (stale.length) {
    console.log(
      `replacing ${stale.length} figure(s) left by another commit (their bytes are in the store)`,
    )
  }
  if (precious.length && !force) {
    console.log(
      `keeping ${precious.length} figure(s) that exist only here — ` +
        '`pnpm figures:push` to publish them, or --force to discard:',
    )
    for (const p of precious) {
      console.log(`  ${figureName(p)}`)
    }
  }
  if (!wanted.length) {
    console.log(`${state.ok.length} figure(s) already present`)
    return
  }

  console.log(`fetching ${wanted.length} figure(s) from the store…`)
  const errors: string[] = []
  let done = 0
  await mapLimit(wanted, 8, async path => {
    const entry = manifest.get(path)!
    try {
      const buf = await fetchBlob(entry)
      const abs = join(repoRoot, path)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, buf)
      done++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  })

  console.log(`  ${done} figure(s) installed`)
  if (errors.length) {
    console.error(`\n${errors.length} figure(s) could not be fetched:`)
    for (const e of errors) {
      console.error(`  ${e}`)
    }
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// push
// ---------------------------------------------------------------------------

function aws(argv: string[]): string {
  return execFileSync('aws', argv, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
}

// One listing rather than a HEAD per figure. If it fails (no credentials, an
// S3 hiccup) we upload everything instead of guessing — every upload is a write
// of bytes to the key that names them, so a redundant one costs a transfer and
// changes nothing.
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

function push() {
  const dryRun = flag('dry-run')
  const before = readManifest()
  const paths = listFigureFiles()
  if (!paths.length) {
    console.error(
      'no figures on disk — refusing to write an empty manifest.\n' +
        'Run `pnpm figures:pull` first if you meant to update one.',
    )
    process.exit(1)
  }

  console.log(`hashing ${paths.length} figure(s)…`)
  const entries = paths.map(describeFile)
  const after = new Map(entries.map(e => [e.path, e]))
  const changes = diffManifests(before, after)

  const existing = readStoreKeys()
  // Deduplicated by key: two figures with identical bytes are one blob, and a
  // figure reverted to a previous state needs no upload at all.
  const toUpload = new Map<string, FigureEntry>()
  for (const e of entries) {
    const key = storeKey(e)
    if (!existing?.has(key)) {
      toUpload.set(key, e)
    }
  }

  console.log(
    `${changes.length} manifest change(s), ${toUpload.size} blob(s) to upload`,
  )
  console.log(formatTextReport(changes, { base: 'figures.lock' }))
  if (dryRun) {
    console.log('\n--dry-run: nothing uploaded, manifest not written')
    return
  }

  if (toUpload.size) {
    // Staged into the CAS layout so this is one `cp --recursive` per extension
    // instead of one `aws` process per figure — the CLI parallelizes internally
    // and a 450-blob first push goes from minutes to seconds. Hardlinked where
    // the filesystem allows, so staging costs no bytes.
    const staging = join(cacheDir, 'staging')
    rmSync(staging, { recursive: true, force: true })
    const extensions = new Set<string>()
    for (const [key, entry] of toUpload) {
      const dest = join(staging, key.slice(storePrefix.length + 1))
      mkdirSync(dirname(dest), { recursive: true })
      const src = join(repoRoot, entry.path)
      try {
        linkSync(src, dest)
      } catch {
        copyFileSync(src, dest)
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
        // Explicit rather than left to the CLI's mimetypes guess, which differs
        // by platform and has historically not known about webp.
        '--content-type',
        CONTENT_TYPES[ext] ?? 'application/octet-stream',
        '--cache-control',
        CACHE_CONTROL,
        '--only-show-errors',
      ])
    }
    rmSync(staging, { recursive: true, force: true })
    console.log(`  ${toUpload.size} blob(s) uploaded`)
  }

  // Only after every blob is in the store. No CloudFront invalidation: these
  // keys are new, and a content-addressed key is never re-served with different
  // bytes, so there is nothing cached to be stale.
  //
  // Skipped when the bytes would be identical. Rewriting regardless is
  // harmless to git's content comparison but it moves the mtime, which leaves
  // figures.lock reading as ` M` in `git status` with an empty `git diff` — and
  // in a worktree several agents share, a file that looks modified but has no
  // diff is precisely what gets swept into somebody else's commit.
  const next = formatManifest(entries)
  if (readFileSync(manifestPath, 'utf8') === next) {
    console.log(`figures.lock already matches (${entries.length} figures)`)
    return
  }
  writeFileSync(manifestPath, next)
  console.log(
    `wrote figures.lock (${entries.length} figures)\n` +
      'Commit it — that diff is the record of what moved.',
  )
}

// ---------------------------------------------------------------------------
// mirror
// ---------------------------------------------------------------------------

// Copy the whole store into a second bucket. This exists because moving figure
// bytes out of git gives up git's best property: every clone was a full replica
// of every revision.
//
// It only half gives it up, which is worth being precise about. The CURRENT set
// is still replicated everywhere — each checkout that has pulled holds all of
// it, and `push` is idempotent, so any one of them rebuilds the entire store in
// about half a minute. What becomes single-copy is SUPERSEDED revisions, which
// nothing reads except `report`'s before/after columns.
//
// Never `--delete`. Against a content-addressed store a sync without it can
// only ever add, so a mirror cannot be poisoned by a deletion on the source —
// which is the failure this is here to survive. That also makes it safe to
// point at a bucket holding other things.
function mirror() {
  const dest = option('dest')
  if (!dest?.startsWith('s3://')) {
    console.error('usage: figures mirror --dest s3://some-bucket/jb2-figures')
    process.exit(1)
  }
  aws([
    's3',
    'sync',
    `${storeBucket}/${storePrefix}/`,
    `${dest.replace(/\/$/, '')}/`,
    '--no-progress',
  ])
  console.log(`mirrored ${storeBucket}/${storePrefix}/ -> ${dest}`)
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

function check() {
  const manifest = readManifest()
  const problems: string[] = []

  if (!manifest.size) {
    console.error('figures.lock is empty or missing')
    process.exit(1)
  }

  const canonical = formatManifest([...manifest.values()])
  if (readFileSync(manifestPath, 'utf8') !== canonical) {
    problems.push(
      'figures.lock is not in canonical form (sorted, one line per figure) — run `pnpm figures:push`',
    )
  }

  const state = inspectWorktree(manifest)
  for (const p of state.untracked) {
    problems.push(
      `${figureName(p)}: on disk but not in figures.lock — run \`pnpm figures:push\``,
    )
  }
  for (const p of state.modified) {
    problems.push(
      `${figureName(p)}: differs from figures.lock — run \`pnpm figures:push\``,
    )
  }
  for (const p of state.missing) {
    problems.push(
      `${figureName(p)}: in figures.lock but not on disk — run \`pnpm figures:pull\``,
    )
  }

  if (flag('remote')) {
    const existing = readStoreKeys()
    if (!existing) {
      problems.push('could not list the store to verify blobs')
    } else {
      for (const entry of manifest.values()) {
        if (!existing.has(storeKey(entry))) {
          problems.push(
            `${figureName(entry.path)}: bytes are not in the store — run \`pnpm figures:push\``,
          )
        }
      }
    }
  }

  if (problems.length) {
    console.error(`${problems.length} problem(s):`)
    for (const p of problems) {
      console.error(`  ${p}`)
    }
    process.exit(1)
  }
  console.log(`figures.lock is consistent (${manifest.size} figures)`)
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

// No manifest at that ref — either it predates the store or the ref is unknown.
// Treat as empty so the first report reads as "everything is new" rather than
// failing.
function baseManifest(ref: string) {
  const manifest = manifestAt(ref)
  if (!manifest) {
    console.error(`(no figures.lock at ${ref}; treating every figure as new)`)
  }
  return manifest ?? new Map()
}

function report() {
  const base = option('base') ?? 'origin/main'
  // "Now", per figure, is its BYTES if they are on disk and its figures.lock
  // line if they are not. One rule, and each half of it is load-bearing.
  //
  // The bytes, because the lock only moves on `push` — so diffing base against
  // the lock alone made the state you are usually in when you want to look at a
  // figure, regenerated and not yet pushed, report as nothing at all. Measured:
  // a run that rewrote eight figures reported the two a concurrent push had
  // already written into the lock, while `figures status` listed all of them.
  //
  // The lock line, because push.yml runs this on a plain checkout with no sweep
  // and no `figures:pull`, and figure bytes are gitignored — so nothing is on
  // disk there and it wants exactly the lock-against-lock diff it always got.
  // Hashing the worktree unconditionally would have reported all 452 as removed
  // on every push. The fallback makes that job byte-for-byte what it was, and
  // does the sensible thing for a partial checkout in between.
  const now = resolveNow(readManifest(), listFigureFiles().map(describeFile))
  const changes = diffManifests(baseManifest(base), now)
  // An `after` whose bytes were never uploaded has a store URL (the key is the
  // hash) and that URL 404s, so the report has to say which ones those are
  // rather than hand over a broken image.
  const unpublished = new Set(unpublishedFigures())
  const markdown = flag('markdown')
  const text = markdown
    ? formatMarkdownReport(changes, { base, unpublished })
    : formatTextReport(changes, { base, unpublished })
  const out = option('out')
  if (out) {
    writeFileSync(out, text)
    console.log(`wrote ${out} (${changes.length} change(s))`)
  } else {
    console.log(text)
  }
}

// ---------------------------------------------------------------------------

const usage = `figures — the S3-backed figure store

  status              compare the worktree against figures.lock
  pull [--force]      install every figure figures.lock names
  push [--dry-run]    upload new bytes, then rewrite figures.lock
  check [--remote]    fail if the manifest and the worktree disagree
  report [--base ref] [--markdown] [--out file]
                      what moved, with before/after store URLs
  mirror --dest s3://…  copy the store to a second bucket (add-only)
`

switch (command) {
  case 'status': {
    reportWorktree(inspectWorktree())
    break
  }
  case 'pull': {
    await pull()
    break
  }
  case 'push': {
    push()
    break
  }
  case 'check': {
    check()
    break
  }
  case 'mirror': {
    mirror()
    break
  }
  case 'report': {
    report()
    break
  }
  default: {
    console.log(usage)
    process.exit(command === '--help' || command === 'help' ? 0 : 1)
  }
}
