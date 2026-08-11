#!/usr/bin/env node

/**
 * Bump the pinned appimagetool.
 *
 *   pnpm update:appimagetool          # latest tagged release
 *   pnpm update:appimagetool 1.9.1    # a specific one
 *
 * A pin is only as good as how easy it is to move: one that takes a manual
 * download, a manual sha256sum and a careful paste is a pin that stays where it
 * is until it breaks. This does the three steps, and — the part a hand bump
 * skips — actually runs the binary before writing the hash, so a release is
 * never the first thing to discover that the new build does not work here.
 *
 * Writes packaging/appimagetool.ts and nothing else. Review the diff and commit
 * it like any other change.
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

import {
  APPIMAGETOOL_SHA256,
  APPIMAGETOOL_VERSION,
  appimagetoolUrl,
} from './packaging/appimagetool.ts'
import { sha256Hex } from './packaging/utils.ts'

const PIN_FILE = path.join(import.meta.dirname, 'packaging', 'appimagetool.ts')
const RELEASES_API =
  'https://api.github.com/repos/AppImage/appimagetool/releases'

function fail(message: string): never {
  console.error(`\n❌ ${message}`)
  process.exit(1)
}

// The newest release that is an actual version. `continuous` is a rolling tag
// rebuilt in place, which is the thing this pin exists to get away from, so it
// is never a candidate however recent it looks.
async function latestTaggedVersion() {
  const res = await fetch(RELEASES_API, {
    headers: { accept: 'application/vnd.github+json' },
  })
  if (!res.ok) {
    fail(`GitHub returned ${res.status} ${res.statusText} for ${RELEASES_API}`)
  }
  const releases = (await res.json()) as {
    tag_name: string
    draft: boolean
    prerelease: boolean
  }[]
  const tag = releases.find(
    r => !r.draft && !r.prerelease && r.tag_name !== 'continuous',
  )?.tag_name
  if (!tag) {
    fail(`no tagged (non-continuous) release found at ${RELEASES_API}`)
  }
  return tag
}

const requested = process.argv[2]
const version = requested ?? (await latestTaggedVersion())
const url = appimagetoolUrl(version)

console.log(`Pinned:    ${APPIMAGETOOL_VERSION}`)
console.log(`Requested: ${version}${requested ? '' : ' (latest tagged)'}`)

const work = mkdtempSync(path.join(tmpdir(), 'jbrowse-appimagetool-'))
const binary = path.join(work, 'appimagetool')

try {
  console.log(`\nDownloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) {
    fail(`${res.status} ${res.statusText} — is ${version} a real release?`)
  }
  fs.writeFileSync(binary, Buffer.from(await res.arrayBuffer()))
  fs.chmodSync(binary, 0o755)

  const sha256 = sha256Hex(binary)
  const size = fs.statSync(binary).size
  console.log(`  ${(size / 1024 / 1024).toFixed(1)} MB, sha256 ${sha256}`)

  // Run it. A tag that exists and hashes fine can still be a build that will
  // not start on this platform, and the release job is a bad place to find out.
  const check = spawnSync(binary, ['--version'], { encoding: 'utf8' })
  if (check.status !== 0) {
    fail(
      `${version} downloaded but would not run: ${check.stderr || check.error?.message}`,
    )
  }
  console.log(`  runs: ${check.stdout.trim() || check.stderr.trim()}`)

  if (version === APPIMAGETOOL_VERSION && sha256 === APPIMAGETOOL_SHA256) {
    console.log('\n✓ already pinned to this build, nothing to write')
  } else {
    const before = fs.readFileSync(PIN_FILE, 'utf8')
    const after = before
      .replace(
        /(export const APPIMAGETOOL_VERSION = ')[^']*(')/,
        `$1${version}$2`,
      )
      .replace(
        /(export const APPIMAGETOOL_SHA256 =\s*')[^']*(')/,
        `$1${sha256}$2`,
      )
    if (after === before) {
      fail(`could not find the constants to rewrite in ${PIN_FILE}`)
    }
    fs.writeFileSync(PIN_FILE, after)
    console.log(
      `\n✓ pinned ${APPIMAGETOOL_VERSION} -> ${version} in ${path.relative(process.cwd(), PIN_FILE)}`,
    )
    console.log('  review the diff and commit it')
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}
