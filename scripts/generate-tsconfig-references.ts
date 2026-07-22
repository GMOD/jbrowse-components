// Keeps each package's `tsconfig.build.esm.json` "references" array in sync with
// the workspace dependencies already declared in its package.json, so the
// TypeScript project graph can't drift from the npm one.
//
// Without references every package resolves its workspace deps to *source*
// (package.json `main` points at `src/index.ts`), so `tsc` re-parses and
// re-checks each dependency's entire source tree once per dependent. References
// make it consume the dependency's emitted `.d.ts` instead.
//
// Run with `--check` in CI to fail on drift instead of rewriting.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { format } from 'prettier'

const check = process.argv.includes('--check')
const root = join(import.meta.dirname, '..')
const workspaceDirs = ['packages', 'plugins', 'products', 'example-plugins']

interface PackageJson {
  name?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

// Every workspace dir that has a build config, keyed by its package name.
const dirByPackageName = new Map<string, string>()
for (const workspaceDir of workspaceDirs) {
  for (const entry of readdirSync(join(root, workspaceDir))) {
    const dir = `${workspaceDir}/${entry}`
    try {
      const { name } = readJson<PackageJson>(join(root, dir, 'package.json'))
      readFileSync(join(root, dir, 'tsconfig.build.esm.json'))
      if (name) {
        dirByPackageName.set(name, dir)
      }
    } catch {
      // no package.json or no build config — not part of the project graph
    }
  }
}

const problems: string[] = []
for (const dir of [...dirByPackageName.values()].sort()) {
  const pkg = readJson<PackageJson>(join(root, dir, 'package.json'))
  const references = Object.entries({
    ...pkg.dependencies,
    ...pkg.peerDependencies,
  })
    .filter(([name, range]) => {
      return range.startsWith('workspace:') && dirByPackageName.has(name)
    })
    .map(([name]) => relative(dir, dirByPackageName.get(name)!))
    .sort()
    .map(path => ({ path: `${path}/tsconfig.build.esm.json` }))

  const configPath = join(root, dir, 'tsconfig.build.esm.json')
  const current = readFileSync(configPath, 'utf8')
  const config = JSON.parse(current) as {
    compilerOptions: Record<string, unknown>
    references?: { path: string }[]
  }
  config.compilerOptions.composite = true
  if (references.length > 0) {
    config.references = references
  } else {
    delete config.references
  }
  const updated = await format(JSON.stringify(config), {
    filepath: configPath,
  })

  if (updated !== current) {
    if (check) {
      problems.push(`${dir}/tsconfig.build.esm.json`)
    } else {
      writeFileSync(configPath, updated)
      console.log(`wrote ${dir}/tsconfig.build.esm.json`)
    }
  }
}

// The root solution file, so `tsc --build tsconfig.build.json` builds the whole
// graph in one process.
const solutionPath = join(root, 'tsconfig.build.json')
const solution = await format(
  JSON.stringify({
    files: [],
    references: [...dirByPackageName.values()]
      .sort()
      .map(dir => ({ path: `${dir}/tsconfig.build.esm.json` })),
  }),
  { filepath: solutionPath },
)
if (solution !== readFileSync(solutionPath, 'utf8')) {
  if (check) {
    problems.push('tsconfig.build.json')
  } else {
    writeFileSync(solutionPath, solution)
    console.log('wrote tsconfig.build.json')
  }
}

if (problems.length > 0) {
  console.error(
    `tsconfig references are out of date — run \`pnpm gen-tsconfig-refs\`:\n${problems.map(p => `  ${p}`).join('\n')}`,
  )
  process.exit(1)
}
console.log(
  check
    ? `tsconfig references are up to date (${dirByPackageName.size} projects)`
    : `synced ${dirByPackageName.size} projects`,
)
