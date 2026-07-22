#!/usr/bin/env node
// Bump versions, write the changelog and blog post, commit, tag, push. CI
// publishes from the tag.
//
//   pnpm release <patch|minor|major> [--skip-ci-check]
//   pnpm release --version 4.4.0-beta.1     # explicit target, incl. prereleases
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

process.chdir(ROOT)

function die(message: string): never {
  console.error(message)
  process.exit(1)
}

function run(command: string, args: string[]) {
  execFileSync(command, args, { stdio: 'inherit' })
}

function capture(command: string, args: string[]) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim()
}

const parsed = (() => {
  try {
    return parseReleaseArgs(process.argv.slice(2))
  } catch (e) {
    die(`${e instanceof Error ? e.message : e}`)
  }
})()
const { skipCiCheck, explicitVersion, level } = parsed

// Preflight
const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== 'main') {
  die('Current branch is not main, please switch to main branch')
}
run('git', ['fetch', 'origin', 'main'])
if (
  capture('git', [
    'rev-list',
    '--left-only',
    '--count',
    'origin/main...main',
  ]) !== '0'
) {
  die('main is not up to date with origin/main. Please pull and try again')
}
if (capture('git', ['status', '--short']) !== '') {
  die('Please discard or stash changes and try again.')
}

// Trust push.yml's result on this commit instead of re-running lint+tests
// locally: faster, and it covers far more than this script ever did.
const head = capture('git', ['rev-parse', 'HEAD'])
if (skipCiCheck) {
  console.log('Skipping the CI status check (--skip-ci-check)')
} else {
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
      const [status, conclusion, name] = line.split('\t')
      return { status, conclusion, name }
    })

  if (checks.length === 0) {
    die(
      `No CI checks found for ${head}. Push the commit and let CI run, or pass --skip-ci-check.`,
    )
  }
  const pending = checks.filter(c => c.status !== 'completed')
  const failed = checks.filter(
    c => !['success', 'skipped', 'neutral', ''].includes(c.conclusion!),
  )
  if (failed.length > 0) {
    die(
      `CI is not green on main:\n${failed.map(c => `  ✗ ${c.name} (${c.conclusion})`).join('\n')}`,
    )
  }
  if (pending.length > 0) {
    die(
      `CI is still running on main:\n${pending.map(c => `  … ${c.name}`).join('\n')}`,
    )
  }
  console.log(`  ✓ ${checks.length} checks green`)
}

// `pnpm format` below runs out of node_modules; keep it matching the lockfile.
run('pnpm', ['install', '--frozen-lockfile'])

// Work out the new version
function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const previousVersion: string = readJson(
  'plugins/alignments/package.json',
).version
const version = (() => {
  try {
    return nextVersion({ previousVersion, level, explicitVersion })
  } catch (e) {
    die(`${e instanceof Error ? e.message : e}`)
  }
})()
const releaseTag = `v${version}`
// A prerelease ships packages and binaries but is not "the release": it gets no
// blog post (so no announcement, and releasenotes.ts finds nothing to put in
// the GitHub release body), no CHANGELOG entry, and must not move
// currentVersion, which drives the download page's asset links.
const prerelease = isPrerelease(version)

console.log(
  `Releasing ${releaseTag}${prerelease ? ' (prerelease)' : ''} (from ${previousVersion})`,
)

const now = new Date()
const p = (n: number) => String(n).padStart(2, '0')
const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
const datetime = `${date} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`

if (prerelease) {
  console.log('  skipping blog post, changelog, and currentVersion bump')
} else {
  const blogpostDraft = `website/release_announcement_drafts/${releaseTag}.md`
  if (!fs.existsSync(blogpostDraft)) {
    die(`No blogpost draft found at ${blogpostDraft}, please write one.`)
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
  const notes = fs.readFileSync(blogpostDraft, 'utf8')
  fs.rmSync(blogpostDraft)

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

// Bump every workspace package, and the version.ts files that mirror them
for (const ws of WORKSPACES) {
  if (!fs.existsSync(ws)) {
    continue
  }
  for (const dir of fs.readdirSync(ws)) {
    const pkgPath = path.join(ws, dir, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      continue
    }
    const pkg = readJson(pkgPath)
    pkg.version = version
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    console.log(`  ${pkg.name} -> ${version}`)
  }
}

// Regenerated, so they can't drift from the package.json versions above
const versionFiles = capture('git', ['ls-files', '*/src/version.ts'])
  .split('\n')
  .filter(Boolean)
for (const versionFile of versionFiles) {
  fs.writeFileSync(versionFile, `export const version = '${version}'\n`)
}
console.log(`  regenerated ${versionFiles.length} version.ts files`)

// Commit, tag, push — CI publishes from the tag. The website deploy is not
// tied to this commit message: update-docs.yml runs on release publish.
run('pnpm', ['format'])
run('git', ['add', '.'])
run('git', ['commit', '--message', releaseTag])
run('git', ['tag', '-a', releaseTag, '-m', releaseTag])
run('git', ['push', '--follow-tags'])

console.log(`✓ Released ${releaseTag}`)
