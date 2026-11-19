// Builds every package `pnpm pack` and `pnpm publish -r` ship, once, so both
// run with lifecycle scripts off. Each package's own `prepack` is `pnpm build`,
// which re-runs `tsc --build` over its whole reference graph: packing them one
// by one compiled the tree ~55 times over.
//
// A package's build is its `clean`, the root `build:esm` it shares with every
// other package, its other `build:*` scripts (or `build` itself, where there is
// no `build:esm`), and whatever its `prepack` runs after `pnpm build`. The
// `build:*` scripts read `src/`, not another package's `esm/`, so they run
// beside `build:esm`; the `prepack` tails run last.
import fs from 'node:fs'
import path from 'node:path'

import { spawn } from 'cross-spawn'

import { mapWithConcurrency } from '../packages/core/src/util/mapWithConcurrency.ts'
import { isPacked } from './componentTestPins.ts'
import { workspaceFolders } from './releaseWorkspaces.ts'

interface PackageJson {
  name: string
  version: string
  private?: boolean
  files?: string[]
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
}

const root = path.resolve(import.meta.dirname, '..')

function readPackageJson(file: string): PackageJson {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function packedPackages() {
  return workspaceFolders(root)
    .filter(group => fs.existsSync(path.join(root, group)))
    .flatMap(group =>
      fs
        .readdirSync(path.join(root, group))
        .map(subdir => path.join(root, group, subdir))
        .filter(dir => fs.existsSync(path.join(dir, 'package.json')))
        .map(dir => ({
          dir,
          pkgJson: readPackageJson(path.join(dir, 'package.json')),
        }))
        .filter(({ pkgJson }) => isPacked(group, pkgJson)),
    )
}

export function pnpm(args: string[], cwd = root) {
  return new Promise<void>((resolve, reject) => {
    spawn('pnpm', args, { cwd, stdio: 'inherit' })
      .on('error', reject)
      .on('exit', (code, signal) => {
        if (code === 0) {
          resolve()
        } else {
          reject(
            new Error(
              `pnpm ${args.join(' ')} in ${path.relative(root, cwd) || '.'} exited ${signal ?? code}`,
            ),
          )
        }
      })
  })
}

export const workspaceFilters = (dirs: string[]) =>
  dirs.flatMap(dir => ['--filter', `./${path.relative(root, dir)}`])

const buildScripts = (scripts: Record<string, string>) =>
  'build:esm' in scripts
    ? Object.keys(scripts).filter(
        s => s.startsWith('build:') && s !== 'build:esm',
      )
    : ['build']

const prepackTail = (scripts: Record<string, string>) =>
  (scripts.prepack ?? '')
    .split('&&')
    .map(step => step.trim())
    .filter(step => step !== '' && step !== 'pnpm build')
    .map(step => step.replace(/^pnpm (run )?/, ''))

export async function buildPublished() {
  const packages = packedPackages()
  const steps = (pick: (scripts: Record<string, string>) => string[]) =>
    packages.flatMap(({ dir, pkgJson }) =>
      pick(pkgJson.scripts ?? {}).map(script => ({ dir, script })),
    )

  await pnpm([
    '-r',
    ...workspaceFilters(packages.map(p => p.dir)),
    'run',
    'clean',
  ])
  await Promise.all([
    pnpm(['build:esm']),
    mapWithConcurrency(steps(buildScripts), 2, ({ dir, script }) =>
      pnpm(['run', script], dir),
    ),
  ])
  for (const { dir, script } of steps(prepackTail)) {
    await pnpm(['run', script], dir)
  }

  const missing = packages.filter(
    ({ dir, pkgJson }) =>
      pkgJson.files?.includes('esm') && !fs.existsSync(path.join(dir, 'esm')),
  )
  if (missing.length > 0) {
    throw new Error(
      `No esm/ after the build, so tsconfig.build.json misses ${missing.map(p => p.pkgJson.name).join(', ')}`,
    )
  }
}

if (import.meta.main) {
  await buildPublished()
}
