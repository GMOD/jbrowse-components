#!/usr/bin/env node

/**
 * Whether a release carries everything a client needs to update from it.
 *
 * Two modes, for the two ways this goes wrong (see packaging/releaseAssets.ts
 * for what either costs):
 *
 * - default, on `v$VERSION`, run after the three desktop jobs and before anyone
 *   publishes the draft — did every platform's upload actually happen.
 * - `--feed`, on whatever GitHub currently calls the latest release — is that
 *   what a running JBrowse Desktop resolves its update check to. That is a
 *   different question, and it can go wrong with nobody touching this repo's
 *   desktop code: publishing the draft before the binaries land moves it, and
 *   so would any non-`v` release published after a `v` one, since the tag is
 *   whatever GitHub decides is newest.
 */
import { execFileSync } from 'child_process'
import { parseArgs } from 'node:util'

import { releaseArtifacts } from './packaging/artifacts.ts'
import {
  APP_NAME,
  GITHUB_OWNER,
  GITHUB_REPO,
  VERSION,
} from './packaging/config.ts'
import { auditRelease, parseUpdateFeed } from './packaging/releaseAssets.ts'

import type { Platform } from './packaging/config.ts'

const ALL: Platform[] = ['linux', 'mac', 'win']

function gh(args: string[]) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
}

// A release that isn't there gets a sentence rather than gh's stack. It is what
// running this before the draft exists looks like, and in a release run it
// arrives alongside whichever earlier job is the actual failure.
function assetsOf(tag: string) {
  try {
    return (
      JSON.parse(gh(['release', 'view', tag, '--json', 'assets'])) as {
        assets: { name: string; size: number }[]
      }
    ).assets
  } catch {
    console.error(`There is no release ${tag} to check.`)
    process.exit(1)
  }
}

// `gh release download` rather than the browser url: in the default mode the
// release is still a draft, and a draft's assets need the token.
function downloadAsset(tag: string, name: string) {
  return gh(['release', 'download', tag, '--pattern', name, '--output', '-'])
}

// What electron-updater's GitHub provider resolves an update check to.
function latestTag() {
  return (
    JSON.parse(
      gh([
        'api',
        `repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
        '--jq',
        '{tag_name: .tag_name}',
      ]),
    ) as { tag_name: string }
  ).tag_name
}

function check(tag: string, version: string) {
  const expected = releaseArtifacts(ALL, { appName: APP_NAME, version })
  const assets = assetsOf(tag)
  const present = new Set(assets.map(a => a.name))
  return auditRelease({
    expected,
    assets,
    // A manifest that is not there is already named by `expected`; reading it
    // would turn one clear problem into two, one of them a gh error.
    manifests: expected
      .filter(name => name.endsWith('.yml') && present.has(name))
      .map(name => ({
        name,
        files: parseUpdateFeed(downloadAsset(tag, name)),
      })),
  })
}

function report(tag: string, problems: string[], consequence: string) {
  if (problems.length > 0) {
    console.error(`Release ${tag} is not complete:\n`)
    for (const problem of problems) {
      console.error(`  ${problem}`)
    }
    console.error(`\n${consequence}`)
    process.exit(1)
  }
}

function main() {
  const { values } = parseArgs({ options: { feed: { type: 'boolean' } } })

  if (values.feed) {
    const tag = latestTag()
    if (!/^v\d/.test(tag)) {
      console.error(
        `The repository's latest release is ${tag}, which is not a JBrowse version tag. Every desktop update check resolves to it and then 404s looking for latest*.yml.`,
      )
      process.exit(1)
    }
    report(
      tag,
      check(tag, tag.slice(1)),
      'Desktop resolves its update check to this release, so the platforms above are not updating right now.',
    )
    console.log(`Desktop updates resolve to ${tag}, which is complete.`)
    return
  }

  const tag = `v${VERSION}`
  report(
    tag,
    check(tag, VERSION),
    'Publishing it moves the release every existing client checks against, so the platforms above stop updating until another one lands.',
  )
  console.log(
    `Release ${tag} carries every desktop artifact, and each manifest matches what is there.`,
  )
}

main()
