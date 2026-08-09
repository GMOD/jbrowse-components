#!/usr/bin/env node

/**
 * Publish script for JBrowse Desktop
 *
 * Uploads packaged artifacts to GitHub releases using the gh CLI.
 * Pass --publish along with a platform flag (--linux, --mac, --win).
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import { releaseArtifacts } from './packaging/artifacts.ts'
import {
  APP_NAME,
  DIST,
  VERSION,
  parsePackagingArgs,
} from './packaging/config.ts'

import type { Platform } from './packaging/config.ts'

// The artifacts this run must upload, by name — not whatever in dist/ matches a
// pattern. Anything the packager was supposed to write and didn't is named
// here, while the upload has still not started.
function resolveArtifacts(platforms: Platform[]) {
  const expected = releaseArtifacts(platforms, {
    appName: APP_NAME,
    version: VERSION,
  })
  const missing = expected.filter(name => !fs.existsSync(path.join(DIST, name)))
  if (missing.length > 0) {
    console.error(
      `Error: ${missing.length} of ${expected.length} expected artifacts are not in ${DIST}:`,
    )
    for (const name of missing) {
      console.error(`  ${name}`)
    }
    console.error('\nDid the packaging step for this platform run and succeed?')
    process.exit(1)
  }
  return expected.map(name => path.join(DIST, name))
}

function uploadToGitHub(artifacts: string[]) {
  const tag = `v${VERSION}`
  const failures: string[] = []

  console.log(`\nUploading ${artifacts.length} artifacts to release ${tag}...`)

  for (const artifact of artifacts) {
    const filename = path.basename(artifact)
    console.log(`  Uploading: ${filename}`)

    try {
      // execFileSync, not a shell string: an artifact name is composed from
      // productName and version, so a space or a quote in either would resplit
      // the command rather than fail.
      execFileSync('gh', ['release', 'upload', tag, artifact, '--clobber'], {
        stdio: 'inherit',
      })
    } catch (e) {
      console.error(
        `  Failed to upload ${filename}: ${e instanceof Error ? e.message : e}`,
      )
      failures.push(filename)
    }
  }

  if (failures.length > 0) {
    console.error(`\nFailed to upload: ${failures.join(', ')}`)
    process.exit(1)
  }

  console.log('\nUpload complete!')
}

function main() {
  const { publish, platforms } = parsePackagingArgs()

  if (!publish) {
    console.log('No --publish flag, skipping upload')
    return
  }

  if (platforms.length === 0) {
    console.error(
      'Error: --publish requires at least one platform flag (--linux, --mac, --win)',
    )
    process.exit(1)
  }

  // --publish was asked for, so every way of not uploading is a failure, not a
  // skip. Exiting 0 here left the release.yml desktop job green with nothing
  // uploaded, and the only thing standing between that and a release shipped
  // without binaries is a human noticing the draft is empty. `pnpm package:<os>`
  // is the build-without-uploading entry point.
  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    console.error(
      'Error: --publish needs GH_TOKEN or GITHUB_TOKEN. Use `pnpm package:<platform>` to build without uploading.',
    )
    process.exit(1)
  }

  const artifacts = resolveArtifacts(platforms)

  console.log('Found artifacts:')
  for (const a of artifacts) {
    console.log(`  ${path.basename(a)}`)
  }

  uploadToGitHub(artifacts)
}

main()
