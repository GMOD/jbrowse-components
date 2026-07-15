import fs from 'node:fs'
import path from 'node:path'

import { sync as spawnSync } from 'cross-spawn'

const subDirs = [
  'cgv-vite',
  'lgv-vite',
  'app-vite',
  'cli-node18',
  'jbrowse-img',
]
const root = path.resolve(import.meta.dirname, '..')
const workspaceDirs = ['packages', 'products', 'plugins']
const packedTarballsByPackageName: Record<string, string> = {}
const dependenciesByPackageName: Record<string, Record<string, string>> = {}

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
          const newName = tarball.replace(/-\d+\.\d+\.\d+/, '')
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

// A hand-curated "resolutions" list pinning packed tarballs can silently
// drift (e.g. a new plugin dependency added but never pinned, falling
// through to whatever version is on the npm registry - this broke cgv-vite's
// build when @jbrowse/plugin-canvas was added without a pin). Walk each
// app's @jbrowse/* dependency closure and pin exactly that set instead of
// hand-maintaining it. Pinning every packed package unconditionally (not
// just the closure) was tried and rejected: yarn still resolves the full
// dependency tree of every "resolutions" entry even if nothing in the app
// depends on it, so an unrelated package's transitive dependency with a
// stricter "engines.node" (e.g. puppeteer, pulled in only by
// @jbrowse/browser-test-utils) can fail an install on an older Node even
// though it's never actually used.
function closureOf(startDeps: Record<string, string>) {
  const closure = new Set<string>()
  const queue = Object.keys(startDeps).filter(
    name => name in packedTarballsByPackageName,
  )
  while (queue.length > 0) {
    const name = queue.pop()!
    if (!closure.has(name)) {
      closure.add(name)
      queue.push(
        ...Object.keys(dependenciesByPackageName[name] ?? {}).filter(
          depName => depName in packedTarballsByPackageName,
        ),
      )
    }
  }
  return closure
}

for (const dir of subDirs) {
  const pkgJsonPath = path.join(root, 'component_tests', dir, 'package.json')
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
  if (pkgJson.resolutions) {
    const closure = closureOf(pkgJson.dependencies ?? {})
    const preserved = Object.fromEntries(
      Object.entries(pkgJson.resolutions as Record<string, string>).filter(
        ([name]) => !(name in packedTarballsByPackageName),
      ),
    )
    pkgJson.resolutions = {
      ...preserved,
      ...Object.fromEntries(
        [...closure]
          .sort()
          .map(name => [
            name,
            `file:./packed/${packedTarballsByPackageName[name]}`,
          ]),
      ),
    }
    fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`)
  }
}
