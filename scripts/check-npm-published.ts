#!/usr/bin/env node
// Fail unless every public workspace package is on npm at the tag's version.
//
//   node scripts/check-npm-published.ts v5.0.0
//
// `pnpm publish -r` is not atomic: a failure partway leaves some packages at
// the new version and the rest missing, and nothing else notices. v5.0.0-beta.14
// shipped @jbrowse/core but not @jbrowse/web that way. Polls, because a
// just-published version can take minutes to show in the registry.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { workspaceManifests } from './releaseWorkspaces.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const POLL_MS = 30_000
const WAIT_MS = 10 * 60_000

const tag = process.argv[2]
if (!tag) {
  console.error('usage: check-npm-published.ts <tag>')
  process.exit(1)
}
const version = tag.replace(/^v/, '')

const publicPackages = workspaceManifests(ROOT)
  .map(
    manifest =>
      JSON.parse(fs.readFileSync(path.join(ROOT, manifest), 'utf8')) as {
        name: string
        private?: boolean
      },
  )
  .filter(pkg => !pkg.private)
  .map(pkg => pkg.name)

async function isPublished(name: string) {
  const res = await fetch(
    `https://registry.npmjs.org/${name.replace('/', '%2f')}`,
    {
      headers: { accept: 'application/vnd.npm.install-v1+json' },
      cache: 'no-store',
    },
  )
  const body = res.ok
    ? ((await res.json()) as { versions: Record<string, unknown> })
    : { versions: {} }
  return version in body.versions
}

async function missingPackages(names: string[]) {
  const published = await Promise.all(names.map(name => isPublished(name)))
  return names.filter((_, i) => !published[i])
}

const deadline = Date.now() + WAIT_MS
let missing = await missingPackages(publicPackages)
while (missing.length > 0 && Date.now() < deadline) {
  console.log(`${missing.length} packages not yet at ${version}; waiting`)
  await new Promise(resolve => setTimeout(resolve, POLL_MS))
  missing = await missingPackages(missing)
}

if (missing.length > 0) {
  console.error(
    `${missing.length} of ${publicPackages.length} public packages are missing ${version} on npm:`,
  )
  for (const name of missing) {
    console.error(`  ${name}`)
  }
  console.error(
    '\nRe-run the Publish job: pnpm publish -r skips the versions already there.',
  )
  process.exit(1)
}

console.log(
  `✓ all ${publicPackages.length} public packages are on npm at ${version}`,
)
