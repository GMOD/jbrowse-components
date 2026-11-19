import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  buildPublished,
  packedPackages,
  pnpm,
  workspaceFilters,
} from './build-published.ts'
import { pinnedFiles, subDirs, tarballName } from './componentTestPins.ts'

const root = path.resolve(import.meta.dirname, '..')
const packedDir = (sub: string) =>
  path.join(root, 'component_tests', sub, 'packed')

// Re-pin the consumer manifests from the tarballs already in each `packed/`
// dir, skipping the build and the pack, so a fix to the pinning logic can be
// tried without either.
const pinOnly = process.argv.includes('--pin-only')

for (const sub of subDirs) {
  fs.mkdirSync(packedDir(sub), { recursive: true })
}

const packages = pinOnly
  ? packedPackages().filter(({ pkgJson }) =>
      subDirs.some(sub =>
        fs.existsSync(path.join(packedDir(sub), tarballName(pkgJson.name))),
      ),
    )
  : packedPackages()

if (!pinOnly) {
  await buildPublished()
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'jbrowse-pack-'))
  await pnpm([
    '--config.ignore-scripts=true',
    '-r',
    ...workspaceFilters(packages.map(p => p.dir)),
    'pack',
    '--pack-destination',
    dest,
  ])
  for (const { pkgJson } of packages) {
    const packed = path.join(
      dest,
      `${pkgJson.name.replace('@', '').replace('/', '-')}-${pkgJson.version}.tgz`,
    )
    for (const sub of subDirs) {
      fs.copyFileSync(
        packed,
        path.join(packedDir(sub), tarballName(pkgJson.name)),
      )
    }
  }
  fs.rmSync(dest, { recursive: true })
}

// The pin lists themselves are computed by componentTestPins.ts, which the
// `generated` job also checks — only `component_tests/*/packed/` is uploaded to
// the component-test job, so it installs from the *committed* manifests and the
// rewrite below never reaches it.
for (const file of pinnedFiles(root, {
  tarballs: Object.fromEntries(
    packages.map(({ pkgJson }) => [pkgJson.name, tarballName(pkgJson.name)]),
  ),
  dependencies: Object.fromEntries(
    packages.map(({ pkgJson }) => [pkgJson.name, pkgJson.dependencies ?? {}]),
  ),
})) {
  fs.writeFileSync(file.path, file.content)
}
