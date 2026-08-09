#!/usr/bin/env node
// Fail if a v* tag disagrees with the versions in the tree it points at.
//
//   node scripts/check-tag-version.ts v4.4.0
//
// Both tag-triggered workflows need this and neither can recover from getting
// it wrong:
//
//   publish.yml reads the dist-tag off the tag name but publishes each
//   package.json's own version, so a `5.0.0-beta.1` tree tagged `v5.0.0` serves
//   a beta to every `npm install` and to the unpkg @latest URLs in the docs.
//   npm only allows unpublishing for 72 hours.
//
//   release.yml's desktop jobs derive their upload target from package.json —
//   `gh release upload "v$VERSION" --clobber` — so a tag that doesn't match the
//   tree uploads this build's binaries over *another* release's assets,
//   silently and irreversibly.
//
// Checks every manifest `pnpm release` bumps rather than one sampled
// package.json. A hand-cut tag is not the only way to get here: a partial bump
// leaves the sampled package right and the rest wrong, and `pnpm publish -r`
// would ship that mixture.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { versionMismatches } from './releaseWorkspaces.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const tag = process.argv[2]
if (!tag) {
  console.error('usage: check-tag-version.ts <tag>')
  process.exit(1)
}

const version = tag.replace(/^v/, '')
const mismatches = versionMismatches(ROOT, version)

if (mismatches.length > 0) {
  console.error(`Tag ${tag} does not match the version in the tree.`)
  for (const m of mismatches) {
    console.error(`  ${m.manifest}: ${m.version ?? '(no version)'}`)
  }
  console.error(
    "\nTags are cut by 'pnpm release', which bumps every package together — this tag was not.",
  )
  process.exit(1)
}

console.log(`✓ ${tag} matches every package version in the tree`)
