// CLI for the figure store. See figure-store.ts for what the store is and why.
//
//   pnpm figures status              what the worktree and figures.lock disagree about
//   pnpm figures:pull                fetch every figure the manifest names (no credentials)
//   pnpm figures:push                upload new bytes, rewrite figures.lock (needs AWS)
//   pnpm figures:push --filter x     ...only the figures matching x
//   pnpm figures:check               CI gate: manifest and worktree agree
//   pnpm figures:report              what moved, with before/after images
//
// IT DRIVES THE MEDIA STORE TOO, for status/pull/push/check. The two corpora are
// produced by the same act — a regen renders stills, a tour is filmed beside
// them — and a second command to remember is a command that gets remembered
// until it doesn't: a `<Video>` whose bytes were never pushed 404s for every
// reader, and only `check-figure-refs` says so. `--filter` reaches both, so
// `figures:push --filter hprc` publishes the HPRC figures and the HPRC tour
// together. `pnpm media` is still the media-only door (scripts/media.ts).
//
// The specialized commands stay figures-only: `report` diffs images, `mirror`
// replicates the figure bucket, and neither has a media counterpart worth
// inventing before something asks for it.
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
import { parseArgs } from 'node:util'

import {
  type WorktreeState,
  cacheDir,
  describeFile,
  fetchBlob,
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
  figureContentTypes,
  figureName,
  figureNames,
  formatManifest,
  formatMarkdownReport,
  formatTextReport,
  mergeManifest,
  resolveNow,
  storeBucket,
  storeKey,
  storePrefix,
  storeUrl,
} from './figure-store.ts'
import { matchesFilterTokens, parseFilterTokens } from './filter-tokens.ts'
import {
  mediaCheck,
  mediaPull,
  mediaPush,
  mediaStatus,
} from './media-commands.ts'

const usage = `figures — the S3-backed figure and media stores

  status              compare the worktree against figures.lock
  pull [--force]      install every figure figures.lock names
  push [--dry-run] [--filter a,b] [--exact] [--allow-deletions]
                      upload new bytes, then rewrite figures.lock. --filter
                      scopes it to the figures named (substring, repeatable,
                      --exact for whole-name) and leaves every other manifest
                      line untouched, which is what a worktree with someone
                      else's regen in it needs. Refuses to drop a manifest line
                      whose figure is missing from disk unless --allow-deletions
  check [--remote]    fail if the manifest and the worktree disagree
  report [--base ref] [--markdown] [--out file]
                      what moved, with before/after store URLs
  mirror --dest s3://…  copy the store to a second bucket (add-only)
`

// STRICT, and that is the whole point of parsing rather than scanning argv for
// substrings. `--filter` decides whether push touches one figure or all 485, so
// a flag this does not recognise has to stop the run: the hand-rolled version
// answered a typo'd `--fliter foo` and a `--filter` with no value the same way
// it answered no flag at all, by publishing the entire worktree without a word.
// Same reasoning, and the same `multiple: true`, as screenshot-options.ts.
const { values, positionals } = (() => {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h', default: false },
        // multiple, so `--filter a --filter b` unions rather than keeping only b
        filter: { type: 'string', multiple: true },
        'dry-run': { type: 'boolean', default: false },
        exact: { type: 'boolean', default: false },
        'allow-deletions': { type: 'boolean', default: false },
        force: { type: 'boolean', default: false },
        remote: { type: 'boolean', default: false },
        markdown: { type: 'boolean', default: false },
        base: { type: 'string' },
        out: { type: 'string' },
        dest: { type: 'string' },
      },
    })
  } catch (e) {
    console.error(`${e instanceof Error ? e.message : String(e)}\n\n${usage}`)
    process.exit(1)
  }
})()
const command = positionals[0] ?? 'status'

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

// Every number and every line here is a FIGURE and the state it reads holds
// PATHS, so all four go through `figureNames` — see it for why those are not
// the same count.
function reportWorktree(state: WorktreeState) {
  const list = (label: string, paths: string[], hint: string) => {
    const names = figureNames(paths)
    if (names.length) {
      console.log(`\n${names.length} ${label} (${hint}):`)
      for (const name of names) {
        console.log(`  ${name}`)
      }
    }
  }
  console.log(`${figureNames(state.ok).length} figure(s) match figures.lock`)
  list('modified', state.modified, 'regenerated locally — `pnpm figures:push`')
  list('new', state.untracked, 'not in the manifest — `pnpm figures:push`')
  list('missing', state.missing, 'not on disk — `pnpm figures:pull`')
}

// ---------------------------------------------------------------------------
// pull
// ---------------------------------------------------------------------------

// fetchBlob lives in figure-paths.ts: `report` and triage-figure-diffs.ts want
// a figure's PREVIOUS revision by the same route, and a second copy of a
// hash-verified cache is a second place for the verification to be forgotten.

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
  const force = values.force
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

// `push` publishes THE WHOLE WORKTREE by default, which is the right default for
// one person on one branch and the wrong one for a worktree several agents share:
// the manifest is rewritten from every figure on disk, so a regen of one figure
// carries whatever anyone else has left lying around into the same figures.lock
// diff, under whichever commit message happens to be written next. `--filter`
// scopes both halves of the operation — the blobs uploaded AND the lines
// rewritten — to the figures named, and every other line is copied through from
// the existing manifest untouched. Matching is on `figureName`, the same
// `dog10k-wolfdog-ancestry` / `tutorial-thumbs/foo` the generator and the reports
// print, substring by default.
//
// One consequence worth stating: `figureName` is not injective (a jbrowse-img
// figure and the website's mirror of it share a name), so a filter selects BOTH
// paths. That is what you want here — the pair are copies and must move together
// — and it is the opposite of what `figurePath` exists for elsewhere.
/**
 * Returns how many figures the selection matched, so the caller can decide what
 * "matched nothing" means now that a push also drives the media store: a
 * `--filter` naming a tour legitimately matches no figure. `-1` says the corpus
 * was skipped for having nothing on disk at all.
 */
function push(): number {
  const dryRun = values['dry-run']
  const tokens = parseFilterTokens(values.filter)
  const before = readManifest()
  const paths = listFigureFiles()
  if (!paths.length) {
    // Skipped rather than fatal, for the same reason the media half skips: with
    // two corpora behind one command, "this one is empty" is a fact about one
    // store and not about the run. The protection is unchanged — an unfiltered
    // merge over an empty selection writes an empty manifest, so it must not
    // run — and the caller below still fails when BOTH stores had nothing.
    console.log(
      'no figures on disk — skipping the figure store.\n' +
        '  `pnpm figures:pull` first if you meant to update one.',
    )
    return -1
  }
  const selected = paths.filter(p =>
    matchesFilterTokens(figureName(p), tokens, values.exact),
  )
  if (!selected.length) {
    return 0
  }

  // Only the selection is hashed. Hashing every figure is 62 MB of reads and the
  // most expensive thing this tool does, so a one-figure push is now instant
  // rather than a full sweep that happens to change one line.
  console.log(`hashing ${selected.length} figure(s)…`)
  const entries = selected.map(describeFile)
  const after = mergeManifest(before, entries, tokens, values.exact)
  if (tokens.length) {
    console.log(
      `--filter ${tokens.join(',')}: ${entries.length} figure(s) selected, ` +
        `${after.size - entries.length} figures.lock line(s) left untouched`,
    )
  }
  const changes = diffManifests(before, after)

  // A REMOVAL IS THE ONE CHANGE THIS CANNOT UNDO, so it is the one that has to
  // be asked for.
  //
  // mergeManifest carries untouched lines through under --filter, which closes
  // that half of the hole. Unfiltered, the manifest is rewritten from whatever
  // is on disk, so a worktree that is merely INCOMPLETE writes a lock that
  // drops the figures it happens not to have. `pull` exiting 1 partway through,
  // an interrupted checkout, an rm -rf of one figure directory all produce that
  // state, and none of them looks like a request to unpublish anything.
  //
  // Nothing downstream notices, which is why this is a hard stop rather than a
  // warning: the bytes stay in the store, so no fetch fails; the site keeps
  // building, because a manifest is valid at any size; and the figures simply
  // stop being installed, for everyone, until somebody reads a `git diff` that
  // is mostly deletions and understands what it means. The `- name` lines in
  // the report below said so all along and are easy to scroll past.
  //
  // Deliberately not gated on `--force`, which pull uses for "discard my local
  // bytes". A flag that means two different destructive things is worse than
  // two flags.
  const removals = changes.filter(c => c.kind === 'removed')
  if (removals.length > 0 && !values['allow-deletions']) {
    console.error(
      `refusing to drop ${removals.length} figure(s) from figures.lock:\n${removals
        .map(c => `  - ${figureName(c.path)}`)
        .join(
          '\n',
        )}\n\nTheir bytes are in the store; only the manifest line would go, and nothing downstream would report them missing.\nIf this worktree is incomplete, \`pnpm figures:pull\` first.\nIf you really mean to unpublish them, re-run with --allow-deletions.`,
    )
    process.exit(1)
  }

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
    return selected.length
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
        figureContentTypes[ext] ?? 'application/octet-stream',
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
  // `after`, not `entries`: under --filter those differ by every line carried
  // through from the old manifest, and writing the selection alone would delete
  // the other 450 figures from the store's index in the name of publishing one.
  const next = formatManifest([...after.values()])
  if (readFileSync(manifestPath, 'utf8') === next) {
    console.log(`figures.lock already matches (${after.size} figures)`)
    return selected.length
  }
  writeFileSync(manifestPath, next)
  console.log(
    `wrote figures.lock (${after.size} figures)\n` +
      'Commit it — that diff is the record of what moved.',
  )
  return selected.length
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
  const dest = values.dest
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

  if (values.remote) {
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
  const base = values.base ?? 'origin/main'
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
  const markdown = values.markdown
  const text = markdown
    ? formatMarkdownReport(changes, { base, unpublished })
    : formatTextReport(changes, { base, unpublished })
  const out = values.out
  if (out) {
    writeFileSync(out, text)
    console.log(`wrote ${out} (${changes.length} change(s))`)
  } else {
    console.log(text)
  }
}

// ---------------------------------------------------------------------------

if (values.help) {
  console.log(usage)
  process.exit(0)
}

// The media half of each shared command runs after the figure half, under a
// heading, so a combined run reads as two stores rather than as one with
// surprising counts in it.
function mediaSection() {
  console.log('\n--- media ---')
}

const mediaOptions = {
  filter: values.filter,
  dryRun: values['dry-run'],
  force: values.force,
  allowDeletions: values['allow-deletions'],
}

switch (command) {
  case 'status': {
    reportWorktree(inspectWorktree())
    mediaSection()
    mediaStatus()
    break
  }
  case 'pull': {
    await pull()
    mediaSection()
    await mediaPull(mediaOptions)
    break
  }
  case 'push': {
    const figures = push()
    mediaSection()
    const media = mediaPush(mediaOptions)
    // Fatal only when NEITHER store had anything to do, which is the state the
    // figure store used to exit on by itself. Split apart, the two answers mean
    // different things and only the pair is actionable: `--filter hprc_end_to_end`
    // matching no figure is correct (it names a tour), and an empty figure
    // directory is correct in a checkout that only pulled media.
    if (figures <= 0 && media <= 0) {
      console.error(
        values.filter?.length
          ? `\nnothing in either store matches --filter ${parseFilterTokens(values.filter).join(',')}`
          : '\nnothing on disk in either store — `pnpm figures:pull` first',
      )
      process.exit(1)
    }
    break
  }
  case 'check': {
    check()
    mediaSection()
    mediaCheck()
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
    // `--help` is a flag now, handled above; an unknown flag never reaches here
    // at all (parseArgs throws). This is only an unknown COMMAND.
    console.log(usage)
    process.exit(command === 'help' ? 0 : 1)
  }
}
