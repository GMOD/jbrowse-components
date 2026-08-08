#!/usr/bin/env node
// Bump versions, write the changelog and blog post, commit, tag, push. CI
// publishes from the tag.
//
//   pnpm release <patch|minor|major> [--skip-ci-check]
//   pnpm release --version 5.0.0-beta.1     # explicit target, incl. prereleases
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  releaseDraftPaths,
  releasePostFilename,
  renderReleasePost,
} from './releaseBlog.ts'
import {
  isPrerelease,
  nextVersion,
  parseReleaseArgs,
} from './releaseVersion.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'GMOD/jbrowse-components'
const WORKSPACES = ['packages', 'products', 'plugins']
const VERSION_SOURCE = 'plugins/alignments/package.json'

process.chdir(ROOT)

const run = (command: string, args: string[]) =>
  execFileSync(command, args, { stdio: 'inherit' })

const capture = (command: string, args: string[]) =>
  execFileSync(command, args, { encoding: 'utf8' }).trim()

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))

function assertReleasableTree() {
  if (capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== 'main') {
    throw new Error('Current branch is not main, please switch to main branch')
  }
  run('git', ['fetch', 'origin', 'main'])
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
  if (capture('git', ['status', '--short']) !== '') {
    throw new Error('Please discard or commit your changes and try again.')
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
function readReleaseDocs(releaseTag: string) {
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
    : capture('scripts/generate-changelog.sh', [])
  console.log(
    override
      ? `Using the hand-written changelog at ${paths.changelog}`
      : 'Generated the changelog from merged PRs',
  )
  // Both are consumed, so neither can be mistaken for a pending release.
  const consumed = [paths.notes, ...(override ? [paths.changelog] : [])]
  return { consumed, notes, changelog }
}

// Returns the paths it touched, so the format and commit below can name them
// rather than sweeping the worktree.
function writeReleaseDocs({
  consumed,
  notes,
  changelog,
  releaseTag,
  date,
  datetime,
}: {
  consumed: string[]
  notes: string
  changelog: string
  releaseTag: string
  date: string
  datetime: string
}) {
  fs.writeFileSync(
    'website/src/config.ts',
    `export const currentVersion = '${releaseTag}'\n`,
  )
  fs.writeFileSync(
    'CHANGELOG.md',
    `${changelog}\n\n${fs.readFileSync('CHANGELOG.md', 'utf8')}`,
  )
  for (const file of consumed) {
    fs.rmSync(file)
  }
  const post = path.join('website/blog', releasePostFilename(releaseTag, date))
  fs.writeFileSync(
    post,
    renderReleasePost({
      template: fs.readFileSync('scripts/blog_template.txt', 'utf8'),
      tag: releaseTag,
      date: datetime,
      notes,
      changelog,
    }),
  )
  return ['website/src/config.ts', 'CHANGELOG.md', ...consumed, post]
}

const workspaceManifests = () =>
  WORKSPACES.filter(ws => fs.existsSync(ws)).flatMap(ws =>
    fs
      .readdirSync(ws)
      .map(dir => path.join(ws, dir, 'package.json'))
      .filter(manifest => fs.existsSync(manifest)),
  )

function bumpVersions(version: string) {
  const manifests = workspaceManifests()
  for (const manifest of manifests) {
    fs.writeFileSync(
      manifest,
      `${JSON.stringify({ ...readJson(manifest), version }, null, 2)}\n`,
    )
  }
  // Regenerated, so they can't drift from the package.json versions above
  const versionFiles = capture('git', ['ls-files', '*/src/version.ts'])
    .split('\n')
    .filter(Boolean)
  for (const file of versionFiles) {
    fs.writeFileSync(file, `export const version = '${version}'\n`)
  }
  console.log(
    `  ${manifests.length} packages and ${versionFiles.length} version.ts files -> ${version}`,
  )
  return [...manifests, ...versionFiles]
}

function main() {
  const { skipCiCheck, explicitVersion, level } = parseReleaseArgs(
    process.argv.slice(2),
  )

  assertReleasableTree()
  if (skipCiCheck) {
    console.log('Skipping the CI status check (--skip-ci-check)')
  } else {
    assertCiGreen(capture('git', ['rev-parse', 'HEAD']))
  }

  const previousVersion: string = readJson(VERSION_SOURCE).version
  const version = nextVersion({ previousVersion, level, explicitVersion })
  const releaseTag = `v${version}`
  const prerelease = isPrerelease(version)
  console.log(
    `Releasing ${releaseTag}${prerelease ? ' (prerelease)' : ''} (from ${previousVersion})`,
  )

  assertTagFree(releaseTag)

  const now = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  const time = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`

  // Read (and so fail) before installing, which is the slow step.
  const docs = prerelease ? undefined : readReleaseDocs(releaseTag)

  // `pnpm format` below runs out of node_modules; keep it matching the lockfile
  run('pnpm', ['install', '--frozen-lockfile'])

  if (docs) {
    console.log('Writing release docs...')
  } else {
    console.log('  skipping blog post, changelog, and currentVersion bump')
  }
  const written = [
    ...(docs
      ? writeReleaseDocs({
          ...docs,
          releaseTag,
          date,
          datetime: `${date} ${time}`,
        })
      : []),
    ...bumpVersions(version),
  ]

  // Named paths, not a bare `pnpm format` + `git add .`. The clean-tree check
  // ran minutes ago, before the install and the format; in a worktree several
  // people or agents share, a sweep here lands their in-flight edits under the
  // release commit. `git commit -- <paths>` takes the working tree at those
  // paths and ignores the index, which also stages the deleted draft.
  //
  // CI publishes from the tag. The website deploy is not tied to this commit
  // message: update-docs.yml runs on release publish.
  run('pnpm', ['format', ...written])
  run('git', ['commit', '--message', releaseTag, '--', ...written])
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
