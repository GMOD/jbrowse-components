import fs from 'node:fs'
import path from 'node:path'

import { sync as spawnSync } from 'cross-spawn'

import { pinnedFiles, subDirs, tarballName } from './componentTestPins.ts'

const root = path.resolve(import.meta.dirname, '..')
// example-plugins/* are private (never published) but still packed: packing is
// the only way a consumer resolves them through the publishConfig exports map
// and built esm/ output, which is exactly what plugin-vite exists to test.
const workspaceDirs = ['packages', 'products', 'plugins', 'example-plugins']
const packedTarballsByPackageName: Record<string, string> = {}
const dependenciesByPackageName: Record<string, Record<string, string>> = {}

// Re-pin the consumer manifests from the tarballs already in each `packed/`
// dir, skipping the (slow) build+pack. Packing every workspace package takes
// tens of minutes, so without this any fix to the pinning logic is untestable
// in a reasonable loop.
const pinOnly = process.argv.includes('--pin-only')

for (const dir of subDirs) {
  fs.mkdirSync(path.join(root, 'component_tests', dir, 'packed'), {
    recursive: true,
  })
}

for (const dir of workspaceDirs) {
  const fullDir = path.join(root, dir)
  if (fs.existsSync(fullDir)) {
    for (const subdir of fs.readdirSync(fullDir)) {
      const pkgDir = path.join(fullDir, subdir)
      const pkgJsonPath = path.join(pkgDir, 'package.json')
      if (fs.existsSync(pkgJsonPath)) {
        const location = pkgDir
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))

        if (pinOnly) {
          // Only register packages whose tarball is actually on disk, so a
          // stale packed/ dir pins exactly what it holds.
          const newName = tarballName(pkgJson.name)
          const anyPacked = subDirs.some(sub =>
            fs.existsSync(
              path.join(root, 'component_tests', sub, 'packed', newName),
            ),
          )
          if (anyPacked) {
            packedTarballsByPackageName[pkgJson.name] = newName
            dependenciesByPackageName[pkgJson.name] = pkgJson.dependencies ?? {}
          }
          continue
        }

        console.log(`Packing ${pkgJson.name}...`)

        // Use --config.ignore-scripts=false to ensure prepack hooks run,
        // even if user has ignore-scripts=true in their .npmrc (which is
        // useful to avoid postinstall scripts but would otherwise block prepack)
        const { signal, status } = spawnSync(
          'pnpm',
          ['--config.ignore-scripts=false', 'pack'],
          {
            stdio: 'inherit',
            cwd: location,
            encoding: 'utf8',
          },
        )
        if (signal || (status !== null && status > 0)) {
          console.error(`Failed to pack ${pkgJson.name}`)
          process.exit(status ?? 1)
        }

        // Verify esm folder exists for packages that should have it
        const esmPath = path.join(location, 'esm')
        if (pkgJson.files?.includes('esm') && !fs.existsSync(esmPath)) {
          console.error(
            `ERROR: ${pkgJson.name} should have esm folder but it doesn't exist!`,
          )
          console.error(`This likely means prepack/build didn't run.`)
          process.exit(1)
        }

        const files = fs.readdirSync(location)
        const tarball = files.find(f => f.endsWith('.tgz'))

        // Log tarball size for debugging
        if (tarball && pkgJson.files?.includes('esm')) {
          const tarPath = path.join(location, tarball)
          const stat = fs.statSync(tarPath)
          console.log(`  Tarball size: ${stat.size} bytes`)
        }
        if (tarball) {
          const newName = tarballName(pkgJson.name)
          packedTarballsByPackageName[pkgJson.name] = newName
          dependenciesByPackageName[pkgJson.name] = pkgJson.dependencies ?? {}
          for (const sub of subDirs) {
            fs.copyFileSync(
              path.join(location, tarball),
              path.join(root, 'component_tests', sub, 'packed', newName),
            )
          }
          fs.rmSync(path.join(location, tarball))
        }
      }
    }
  }
}

// The pin lists themselves are computed by componentTestPins.ts, which the lint
// job also runs with --check — only `component_tests/*/packed/` is uploaded to
// the component-test job, so it installs from the *committed* manifests and the
// rewrite below never reaches it.
for (const file of pinnedFiles(root, {
  tarballs: packedTarballsByPackageName,
  dependencies: dependenciesByPackageName,
})) {
  fs.writeFileSync(file.path, file.content)
}
