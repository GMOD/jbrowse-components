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

import { releasePostFilename, renderReleasePost } from './releaseBlog.ts'
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
    throw new Error('Please discard or stash changes and try again.')
  }
}

// Trust push.yml's result on this commit instead of re-running lint+tests
// locally: faster, and it covers far more than this script ever did.
function assertCiGreen(head: string) {
  console.log(`Checking CI status for ${head.slice(0, 9)}...`)
  const checks = capture('gh', [
    'api',
    `repos/${REPO}/commits/${head}/check-runs`,
    '--paginate',
    '--jq',
    '.check_runs[] | "\\(.status)\\t\\(.conclusion // "")\\t\\(.name)"',
  ])
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [status, conclusion = '', name = ''] = line.split('\t')
      return { status, conclusion, name }
    })

  if (checks.length === 0) {
    throw new Error(
      `No CI checks found for ${head}. Push the commit and let CI run, or pass --skip-ci-check.`,
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
function writeReleaseDocs(releaseTag: string, date: string, datetime: string) {
  const draft = `website/release_announcement_drafts/${releaseTag}.md`
  if (!fs.existsSync(draft)) {
    throw new Error(`No blogpost draft found at ${draft}, please write one.`)
  }

  fs.writeFileSync(
    'website/src/config.ts',
    `export const currentVersion = '${releaseTag}'\n`,
  )

  console.log('Generating changelog...')
  const changelog = capture('scripts/generate-changelog.sh', [])
  fs.writeFileSync(
    'CHANGELOG.md',
    `${changelog}\n\n${fs.readFileSync('CHANGELOG.md', 'utf8')}`,
  )

  // Consume the draft so it can't be mistaken for a pending release
  const notes = fs.readFileSync(draft, 'utf8')
  fs.rmSync(draft)

  fs.writeFileSync(
    path.join('website/blog', releasePostFilename(releaseTag, date)),
    renderReleasePost({
      template: fs.readFileSync('scripts/blog_template.txt', 'utf8'),
      tag: releaseTag,
      date: datetime,
      notes,
      changelog,
    }),
  )
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

  // `pnpm format` below runs out of node_modules; keep it matching the lockfile
  run('pnpm', ['install', '--frozen-lockfile'])

  const previousVersion: string = readJson(VERSION_SOURCE).version
  const version = nextVersion({ previousVersion, level, explicitVersion })
  const releaseTag = `v${version}`
  const prerelease = isPrerelease(version)
  console.log(
    `Releasing ${releaseTag}${prerelease ? ' (prerelease)' : ''} (from ${previousVersion})`,
  )

  const now = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  const time = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`

  if (prerelease) {
    console.log('  skipping blog post, changelog, and currentVersion bump')
  } else {
    writeReleaseDocs(releaseTag, date, `${date} ${time}`)
  }

  bumpVersions(version)

  // CI publishes from the tag. The website deploy is not tied to this commit
  // message: update-docs.yml runs on release publish.
  run('pnpm', ['format'])
  run('git', ['add', '.'])
  run('git', ['commit', '--message', releaseTag])
  run('git', ['tag', '-a', releaseTag, '-m', releaseTag])
  run('git', ['push', '--follow-tags'])

  console.log(`✓ Released ${releaseTag}`)
}

try {
  main()
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}
