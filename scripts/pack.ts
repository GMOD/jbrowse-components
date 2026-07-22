import fs from 'node:fs'
import path from 'node:path'

import { sync as spawnSync } from 'cross-spawn'

const subDirs = [
  'cgv-vite',
  'lgv-vite',
  'app-vite',
  'plugin-vite',
  'cli-node18',
  'jbrowse-img',
]
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
          // Same name pnpm pack produces, minus the version: @jbrowse/core ->
          // jbrowse-core.tgz. Only register packages whose tarball is actually
          // on disk, so a stale packed/ dir pins exactly what it holds.
          const newName = `${pkgJson.name.replace('@', '').replace('/', '-')}.tgz`
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

// Pin the closure to packed tarballs. The yarn apps spell this `resolutions`
// in package.json; the pnpm apps spell it `overrides` in pnpm-workspace.yaml
// (pnpm 11 dropped the `pnpm` field from package.json, and an overrides map
// left there is ignored *silently* — the install just falls through to the
// registry). The computed value is identical either way.
function pinnedClosure(
  existing: Record<string, string>,
  deps: Record<string, string>,
) {
  const preserved = Object.fromEntries(
    Object.entries(existing).filter(
      ([name]) => !(name in packedTarballsByPackageName),
    ),
  )
  return {
    ...preserved,
    ...Object.fromEntries(
      [...closureOf(deps)]
        .sort()
        .map(name => [
          name,
          `file:./packed/${packedTarballsByPackageName[name]}`,
        ]),
    ),
  }
}

const BEGIN = '# BEGIN packed-overrides'
const END = '# END packed-overrides'

// Rewrite the marker-delimited `overrides:` block in a pnpm app's
// pnpm-workspace.yaml. Hand-rolled rather than pulling in a YAML serializer:
// every key and value is a plain quoted string, and the surrounding file
// (comments, allowBuilds) is preserved verbatim.
function writeYamlOverrides(ymlPath: string, pins: Record<string, string>) {
  const yml = fs.readFileSync(ymlPath, 'utf8')
  const start = yml.indexOf(BEGIN)
  const end = yml.indexOf(END)
  if (start === -1 || end === -1) {
    throw new Error(`${ymlPath} is missing the ${BEGIN}/${END} markers`)
  }
  const entries = Object.entries(pins)
  const body =
    entries.length > 0
      ? `overrides:\n${entries.map(([k, v]) => `  '${k}': '${v}'`).join('\n')}\n`
      : 'overrides: {}\n'
  fs.writeFileSync(
    ymlPath,
    `${yml.slice(0, start)}${BEGIN} (generated by scripts/pack.ts, do not edit by hand)\n${body}${yml.slice(end)}`,
  )
}

for (const dir of subDirs) {
  const appDir = path.join(root, 'component_tests', dir)
  const pkgJsonPath = path.join(appDir, 'package.json')
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
  const deps = pkgJson.dependencies ?? {}

  if (pkgJson.resolutions) {
    pkgJson.resolutions = pinnedClosure(pkgJson.resolutions, deps)
    fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`)
  }

  const ymlPath = path.join(appDir, 'pnpm-workspace.yaml')
  if (fs.existsSync(ymlPath)) {
    writeYamlOverrides(ymlPath, pinnedClosure({}, deps))
  }
}
