import fs from 'node:fs'
import path from 'node:path'

import { spawn } from 'cross-spawn'

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

export async function buildPublished() {
  const filters = workspaceFilters(packedPackages().map(p => p.dir))
  await pnpm(['-r', ...filters, 'run', 'clean'])
  await Promise.all([
    pnpm(['build:esm']),
    pnpm([
      '-r',
      ...filters,
      '--workspace-concurrency=2',
      'run',
      '/^build:(?!esm$)/',
    ]),
  ])

  const packages = packedPackages()
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
