#!/usr/bin/env node
// Bump versions, write the changelog and blog post, commit, tag, push. CI
// publishes from the tag.
//
//   pnpm release <patch|minor|major> [--skip-ci-check]
//   pnpm release --version 5.0.0-beta.1     # explicit target, incl. prereleases
//   pnpm release minor --dry-run            # render everything, write nothing
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DRAFTS_DIR,
  REPO,
  formatDiffstat,
  releaseDraftPaths,
  releasePostFilename,
  releaseTimestamp,
  renderReleasePost,
} from './releaseBlog.ts'
import {
  isPrerelease,
  nextVersion,
  parseReleaseArgs,
} from './releaseVersion.ts'
import { workspaceManifests } from './releaseWorkspaces.ts'

import type { ReleaseStats } from './releaseBlog.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VERSION_SOURCE = 'plugins/alignments/package.json'

process.chdir(ROOT)

const run = (command: string, args: string[]) =>
  execFileSync(command, args, { stdio: 'inherit' })

const capture = (command: string, args: string[]) =>
  execFileSync(command, args, { encoding: 'utf8' }).trim()

// For a step whose output is only interesting when it fails. The format step is
// the one: it echoes a 65-path command line, which in a dry run buries the
// rendered post the run exists to show, and in a real release buries the commit
// and push.
function runQuiet(command: string, args: string[], what: string) {
  console.log(`${what}...`)
  try {
    execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe' })
  } catch (e) {
    const { stdout, stderr } = e as { stdout?: string; stderr?: string }
    throw new Error(`${what} failed:\n${stdout ?? ''}${stderr ?? ''}`, {
      cause: e,
    })
  }
}

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))

// The `version.ts` files the release regenerates, alongside the manifests
// workspaceManifests names. One function because the clean check and the writer
// are two halves of one claim about what a release touches, and a release that
// found them out of step would have already written half of it.
const versionFiles = () =>
  capture('git', ['ls-files', '*/src/version.ts']).split('\n').filter(Boolean)

function assertReleasableTree() {
  if (capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== 'main') {
    throw new Error('Current branch is not main, please switch to main branch')
  }
  // --tags as well as main: generate-changelog.sh dates its boundary from the
  // previous release tag's commit, so that tag has to be in this checkout.
  // Auto-follow would usually bring it along with main, but "usually" is not
  // something to discover halfway through a release.
  run('git', ['fetch', '--tags', 'origin', 'main'])
  const behind = capture('git', [
    'rev-list',
    '--left-only',
    '--count',
    'origin/main...main',
  ])
  if (behind !== '0') {
    throw new Error(
      'main is not up to date with origin/main. Please pull and try again',
    )
  }
  assertReleasePathsClean()
}

// Only the paths a release writes, rather than the whole worktree.
//
// A bare `git status --short` was both too strict and beside the point: it
// counts untracked files, so in a worktree several agents share anybody's
// scratch file blocked the release, for a reason with nothing to do with it.
// What actually matters is narrower — `git commit -- <paths>` takes the working
// tree at exactly these paths, so an uncommitted edit to one of them is the
// only thing that can ride into the release commit under its message, or be
// destroyed by the release overwriting it.
//
// The drafts directory is included whole: the release deletes the draft it
// consumes, and deleting an uncommitted file is not recoverable.
function assertReleasePathsClean() {
  const paths = [
    'CHANGELOG.md',
    'website/src/config.ts',
    'website/blog',
    DRAFTS_DIR,
    ...workspaceManifests(ROOT),
    ...versionFiles(),
  ]
  const dirty = capture('git', [
    'status',
    '--porcelain',
    '--untracked-files=no',
    '--',
    ...paths,
  ])
  if (dirty !== '') {
    throw new Error(
      `These are files the release writes, and they have uncommitted changes:\n${dirty}\n` +
        'Commit or discard them and try again. Anything else in the worktree is fine.',
    )
  }
}

// `git tag` refuses to overwrite, but it runs *after* the commit, so hitting
// that leaves a release commit sitting on main with no tag and no way to
// re-run — the second attempt sees a dirty-free tree whose versions are
// already bumped and cuts a second commit. Checked up front instead, on both
// sides: a tag pushed by someone else is just as fatal, and only shows up when
// the push at the end is rejected.
function assertTagFree(tag: string) {
  if (capture('git', ['tag', '--list', tag]) !== '') {
    throw new Error(
      `Tag ${tag} already exists locally. Delete it (git tag -d ${tag}) or pick another version.`,
    )
  }
  if (capture('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`])) {
    throw new Error(`Tag ${tag} is already on origin — ${tag} is released.`)
  }
}

// Trust push.yml's result on this commit instead of re-running lint+tests
// locally: faster, and it covers far more than this script ever did.
function assertCiGreen(head: string) {
  console.log(`Checking CI status for ${head.slice(0, 9)}...`)
  // gh exits non-zero when the SHA is unknown to GitHub, which is the common
  // case of "you haven't pushed yet" — report that rather than letting the raw
  // "Command failed: gh api …" surface.
  let raw: string
  try {
    raw = capture('gh', [
      'api',
      `repos/${REPO}/commits/${head}/check-runs`,
      '--paginate',
      '--jq',
      '.check_runs[] | "\\(.status)\\t\\(.conclusion // "")\\t\\(.name)"',
    ])
  } catch {
    throw new Error(
      `Could not read CI status for ${head.slice(0, 9)} — is it pushed to origin? Push it and let CI run, or pass --skip-ci-check.`,
    )
  }
  const checks = raw
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [status, conclusion = '', name = ''] = line.split('\t')
      return { status, conclusion, name }
    })

  if (checks.length === 0) {
    throw new Error(
      `No CI checks found for ${head.slice(0, 9)}. Wait for CI to start, or pass --skip-ci-check.`,
    )
  }
  const list = (cs: typeof checks, mark: string) =>
    cs.map(c => `  ${mark} ${c.name}`).join('\n')
  const failed = checks.filter(
    c => !['success', 'skipped', 'neutral', ''].includes(c.conclusion),
  )
  if (failed.length > 0) {
    throw new Error(`CI is not green on main:\n${list(failed, '✗')}`)
  }
  const pending = checks.filter(c => c.status !== 'completed')
  if (pending.length > 0) {
    throw new Error(`CI is still running on main:\n${list(pending, '…')}`)
  }
  console.log(`  ✓ ${checks.length} checks green`)
}

// A prerelease ships packages and binaries but is not "the release": it gets no
// blog post (so no announcement, and releasenotes.ts finds nothing for the
// GitHub release body), no CHANGELOG entry, and must not move currentVersion,
// which drives the download page's asset links.
//
// Split read-then-write on purpose. Both of these can fail — a missing draft, a
// gh that isn't authenticated — and the write half is followed immediately by a
// commit, tag and push, so a throw *between* writes leaves the tree half
// released: currentVersion moved, the draft deleted, no post. Everything that
// can fail is done here, before the first byte is written.
function readReleaseDocs(releaseTag: string, changelogSince: string[]) {
  const paths = releaseDraftPaths(releaseTag)
  if (!fs.existsSync(paths.notes)) {
    throw new Error(
      `No blogpost draft found at ${paths.notes}, please write one.`,
    )
  }
  const notes = fs.readFileSync(paths.notes, 'utf8')
  // Also a check-docs validator, so this normally passed hours ago — but
  // --skip-ci-check exists, and this is the last moment a broken figure path
  // or a duplicated `## Downloads` can still be fixed.
  console.log('Checking the drafts...')
  run('node', ['website/scripts/check-release-drafts.ts'])

  const override = fs.existsSync(paths.changelog)
  const changelog = override
    ? fs.readFileSync(paths.changelog, 'utf8').trim()
    : capture('scripts/generate-changelog.sh', changelogSince)
  console.log(
    override
      ? `Using the hand-written changelog at ${paths.changelog}`
      : 'Generated the changelog from merged PRs',
  )
  // The figures the draft asked the release to compute, resolved here with
  // everything else that can fail and before the first byte is written.
  //
  // The boundary is the last STABLE tag reachable from HEAD, not the version in
  // the tree: a stable release cut from a beta series would otherwise measure
  // itself against its own last beta and report a fraction of the release. The
  // same reason changelogSince above falls through to `releases/latest` there.
  const stats = notes.includes('${DIFFSTAT}')
    ? {
        DIFFSTAT: formatDiffstat(
          capture('git', [
            'diff',
            '--shortstat',
            `${capture('git', [
              'describe',
              '--tags',
              '--abbrev=0',
              '--match',
              'v[0-9]*',
              '--exclude',
              '*-*',
              'HEAD',
            ])}..HEAD`,
          ]),
        ),
      }
    : {}

  // Both are consumed, so neither can be mistaken for a pending release.
  const consumed = [paths.notes, ...(override ? [paths.changelog] : [])]
  // A draft that was never committed is the one file here with no copy
  // anywhere: the release deletes it, and `git rm`-by-hand is not what happens
  // — `fs.rmSync` is. It would also abort the commit that names it, since a
  // pathspec commit refuses a path git has never heard of, so the failure would
  // land after the delete rather than before it.
  //
  // assertReleasePathsClean cannot catch this: it passes --untracked-files=no
  // so that a scratch file in a shared worktree doesn't block a release, which
  // is right for every other path it checks and exactly wrong for this one.
  // Drafts are committed for review anyway — check-release-drafts gates them in
  // CI — so this normally passes.
  for (const file of consumed) {
    if (capture('git', ['ls-files', '--', file]) === '') {
      throw new Error(
        `${file} is not committed, and the release deletes the draft it consumes.\n` +
          `Commit it first: git add ${file}`,
      )
    }
  }
  return { consumed, notes, changelog, stats }
}

// Everything below writes through this, reading from the repo and writing under
// `destDir`. For a real release destDir is the repo; for --dry-run it is a
// throwaway directory, and that one substitution is the *entire* difference
// between the two runs. Nothing downstream branches on which one it is, so a
// dry run exercises the same renderer, the same JSON serialization and the same
// file list rather than a parallel description of them.
const writeUnder = (destDir: string, relPath: string, contents: string) => {
  const target = path.join(destDir, relPath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, contents)
}

// `written` and `deleted` are kept apart so the format step can name only files
// that exist and the commit can name both — `git commit -- <paths>` takes the
// working tree at those paths, which is what stages the consumed draft's
// deletion.
function writeReleaseDocs({
  consumed,
  notes,
  changelog,
  stats,
  releaseTag,
  date,
  datetime,
  destDir,
}: {
  consumed: string[]
  notes: string
  changelog: string
  stats: ReleaseStats
  releaseTag: string
  date: string
  datetime: string
  destDir: string
}) {
  const post = path.join('website/blog', releasePostFilename(releaseTag, date))
  writeUnder(
    destDir,
    'website/src/config.ts',
    `export const currentVersion = '${releaseTag}'\n`,
  )
  writeUnder(
    destDir,
    'CHANGELOG.md',
    `${changelog}\n\n${fs.readFileSync('CHANGELOG.md', 'utf8')}`,
  )
  writeUnder(
    destDir,
    post,
    renderReleasePost({
      template: fs.readFileSync('scripts/blog_template.txt', 'utf8'),
      tag: releaseTag,
      date: datetime,
      notes,
      changelog,
      stats,
    }),
  )
  return {
    written: ['website/src/config.ts', 'CHANGELOG.md', post],
    deleted: consumed,
    post,
  }
}

function bumpVersions(version: string, destDir: string) {
  const manifests = workspaceManifests(ROOT)
  for (const manifest of manifests) {
    writeUnder(
      destDir,
      manifest,
      `${JSON.stringify({ ...readJson(manifest), version }, null, 2)}\n`,
    )
  }
  // Regenerated, so they can't drift from the package.json versions above
  const versions = versionFiles()
  for (const file of versions) {
    writeUnder(destDir, file, `export const version = '${version}'\n`)
  }
  console.log(
    `  ${manifests.length} packages and ${versions.length} version.ts files -> ${version}`,
  )
  return [...manifests, ...versions]
}

// What a dry run has to show is the bytes that would be committed, not an
// approximation of them — so it prints the post *after* the same `pnpm format`
// the real path runs, and the post is the artifact with no second chance.
// `docs` and `bumped` are handed in as the two sets the writers already return,
// rather than re-derived from the combined list by extension — the first
// attempt at that filter listed the version.ts files individually and then
// counted them again in the bulk line.
function reportDryRun({
  destDir,
  releaseTag,
  docs,
  bumped,
  deleted,
  post,
}: {
  destDir: string
  releaseTag: string
  docs: string[]
  bumped: string[]
  deleted: string[]
  post?: string
}) {
  const rule = '─'.repeat(72)
  if (post) {
    console.log(`\n${rule}\n${post}\n${rule}`)
    console.log(fs.readFileSync(path.join(destDir, post), 'utf8').trimEnd())
    console.log(rule)
  }
  // The docs are named because each one is a decision someone made; the
  // manifests and version.ts files are counted because they are all one edit.
  console.log(
    `\nWould commit ${docs.length + bumped.length + deleted.length} files:`,
  )
  for (const file of docs) {
    console.log(`  + ${file}`)
  }
  console.log(
    `  + ${bumped.length} package.json and version.ts files -> ${releaseTag.slice(1)}`,
  )
  for (const file of deleted) {
    console.log(`  - ${file}`)
  }
  console.log(`\nWould then tag ${releaseTag} and push.`)
  console.log(`Rendered tree left at ${destDir} — nothing in the repo changed.`)
}

function main() {
  const { skipCiCheck, explicitVersion, level, dryRun } = parseReleaseArgs(
    process.argv.slice(2),
  )

  // A dry run still runs every check. The point is to see what a release would
  // produce *and* that it would be allowed to, which is why it does not relax
  // the clean-tree, tag-free or green-CI gates — --skip-ci-check already exists
  // for the slow one.
  if (dryRun) {
    console.log('Dry run — the repo will not be modified\n')
  }

  assertReleasableTree()

  const previousVersion: string = readJson(VERSION_SOURCE).version
  const version = nextVersion({ previousVersion, level, explicitVersion })
  const releaseTag = `v${version}`
  const prerelease = isPrerelease(version)
  console.log(
    `Releasing ${releaseTag}${prerelease ? ' (prerelease)' : ''} (from ${previousVersion})`,
  )

  // Before the CI check, which is the slow one: an already-released version is
  // a local lookup and the commonest way to mistype a release.
  assertTagFree(releaseTag)

  if (skipCiCheck) {
    console.log('Skipping the CI status check (--skip-ci-check)')
  } else {
    assertCiGreen(capture('git', ['rev-parse', 'HEAD']))
  }

  // The tag the changelog is generated against. The version in the tree names
  // the tag this release is cut from, exactly — and unlike the script's own
  // `releases/latest` default it is right even when the previous release's
  // GitHub draft has not been published yet, where `releases/latest` silently
  // reaches back one further and re-lists a changelog that already shipped.
  //
  // A prerelease base is the exception: v5.0.0-beta.2 would scope the stable
  // v5.0.0 changelog to the last beta window. Fall through to `releases/latest`
  // there, which skips prereleases and so names the last stable release.
  const changelogSince = isPrerelease(previousVersion)
    ? []
    : [`v${previousVersion}`]

  const { date, datetime } = releaseTimestamp(new Date())

  // Read (and so fail) before installing, which is the slow step.
  const docs = prerelease
    ? undefined
    : readReleaseDocs(releaseTag, changelogSince)

  // `pnpm format` below runs out of node_modules; keep it matching the lockfile.
  // A dry run formats too, but out of whatever node_modules is already here —
  // it must not be the step that decides a release is slow enough to skip.
  if (!dryRun) {
    run('pnpm', ['install', '--frozen-lockfile'])
  }

  if (docs) {
    console.log('Writing release docs...')
  } else {
    console.log('  skipping blog post, changelog, and currentVersion bump')
  }
  const destDir = dryRun
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'jbrowse-release-'))
    : ROOT
  const rendered = docs
    ? writeReleaseDocs({ ...docs, releaseTag, date, datetime, destDir })
    : undefined
  const bumped = bumpVersions(version, destDir)
  const written = [...(rendered?.written ?? []), ...bumped]
  const deleted = rendered?.deleted ?? []

  // Named paths, not a bare format + `git add .`. The clean-tree check ran
  // minutes ago, before the install and the format; in a worktree several
  // people or agents share, a sweep here lands their in-flight edits under the
  // release commit.
  //
  // oxfmt directly rather than `pnpm format`, whose postformat hook runs
  // `prettier --write` over every .astro in the repo. A release writes .md,
  // .json and .ts and never an .astro, so that pass can only do one thing here:
  // reformat a website file the release was not asked to touch. In a dry run it
  // would do it *in the repo*, since the hook ignores the paths and runs from
  // the repo root — the one step that is not redirected by destDir, in a run
  // whose whole promise is that nothing in the repo changes.
  //
  // CI publishes from the tag. The website deploy is not tied to this commit
  // message: update-docs.yml runs on release publish.
  runQuiet(
    'pnpm',
    ['exec', 'oxfmt', ...written.map(f => path.join(destDir, f))],
    'Formatting',
  )

  if (dryRun) {
    reportDryRun({
      destDir,
      releaseTag,
      docs: rendered?.written ?? [],
      bumped,
      deleted,
      post: rendered?.post,
    })
    return
  }

  // Deleted only now, and only for real: everything above is recoverable up to
  // this point, and a dry run must leave the draft where it found it.
  for (const file of deleted) {
    fs.rmSync(file)
  }
  // Staged first because a pathspec commit refuses a path git does not already
  // know, and the blog post is a brand-new file on every release — naming it in
  // `git commit -- <paths>` alone fails with "pathspec ... did not match any
  // file(s) known to git", after the versions are bumped and the draft is
  // deleted. (Not a silent skip: git aborts the whole commit.)
  //
  // Staging exactly these paths does not widen what the commit takes. `git
  // commit -- <paths>` still builds its tree from HEAD plus the working tree at
  // those paths and ignores the index, so in a shared checkout another agent's
  // staged work stays staged and uncommitted, which is the property this form
  // was chosen for.
  run('git', ['add', '--', ...written, ...deleted])
  run('git', ['commit', '--message', releaseTag, '--', ...written, ...deleted])
  run('git', ['tag', '-a', releaseTag, '-m', releaseTag])
  try {
    run('git', ['push', '--follow-tags'])
  } catch (e) {
    // The commit and tag are local at this point, so the release is recoverable
    // — but only if you know not to re-run and cut a second one. The tag has to
    // come off before the rebase and go back on after: an annotated tag names a
    // commit, and the rebase replaces the one it names.
    throw new Error(
      `Push failed (${e instanceof Error ? e.message : e}).\n` +
        `${releaseTag} is committed and tagged LOCALLY. Do not re-run pnpm release.\n` +
        'Rebase onto whatever landed, then re-tag and push:\n' +
        `  git tag -d ${releaseTag} && git pull --rebase && git tag -a ${releaseTag} -m ${releaseTag} && git push --follow-tags\n` +
        `To abandon instead: git tag -d ${releaseTag} && git reset --hard origin/main`,
      { cause: e },
    )
  }

  console.log(`✓ Released ${releaseTag}`)
}

try {
  main()
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}
