// One conda environment holding every tool the tutorials install, built from
// website/scripts/api-docs/tutorialInstall.json without root, and a check that
// each registry entry delivers the commands a page runs. A package name can
// resolve and still ship the wrong thing (conda's `duckdb` is the Python
// library, the `duckdb` command is `duckdb-cli`); only installing it shows that.
//
// An entry's `bins` lists its commands (default: the entry's own name) and
// `modules` the Python modules it provides. Cargo, npm and download-only tools
// stay out: the env holds what conda and pip deliver.
//
// Run: node scripts/tutorial-tools-env.ts create <prefix>
//      node scripts/tutorial-tools-env.ts check <prefix>
// `create` prints each command before running it, so its output is the recipe.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

interface Entry {
  conda?: string
  pip?: string
  bins?: string[]
  modules?: string[]
}

const registry = JSON.parse(
  readFileSync(
    new URL(
      '../website/scripts/api-docs/tutorialInstall.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as Record<string, Entry>

const entries = Object.entries(registry).filter(([, e]) => e.conda ?? e.pip)

function condaFrontend() {
  const found = ['micromamba', 'mamba', 'conda'].find(
    bin => spawnSync(bin, ['--version'], { stdio: 'ignore' }).status === 0,
  )
  if (!found) {
    throw new Error('no micromamba, mamba or conda on PATH')
  }
  return found
}

function run(cmd: string, args: string[]) {
  console.log(`$ ${[cmd, ...args].join(' ')}`)
  execFileSync(cmd, args, { stdio: 'inherit' })
}

function create(prefix: string) {
  const condaPackages = entries.flatMap(([, e]) => (e.conda ? [e.conda] : []))
  const pipPackages = entries.flatMap(([, e]) => (e.pip ? [e.pip] : []))
  run(condaFrontend(), [
    'create',
    '-y',
    '-p',
    prefix,
    '-c',
    'conda-forge',
    '-c',
    'bioconda',
    'python=3.11',
    'pip',
    ...condaPackages,
  ])
  run(path.join(prefix, 'bin', 'python'), [
    '-m',
    'pip',
    'install',
    ...pipPackages,
  ])
}

function check(prefix: string) {
  const bin = path.join(prefix, 'bin')
  const problems = entries.flatMap(([tool, e]) => {
    const manager = e.conda ? `conda ${e.conda}` : `pip ${e.pip}`
    const missingBins = (e.bins ?? [tool]).filter(
      b => !existsSync(path.join(bin, b)),
    )
    const missingModules = (e.modules ?? []).filter(
      m =>
        spawnSync(path.join(bin, 'python'), ['-c', `import ${m}`], {
          stdio: 'ignore',
        }).status !== 0,
    )
    return [
      ...missingBins.map(b => `${tool}: ${manager} installs no \`${b}\``),
      ...missingModules.map(
        m => `${tool}: ${manager} gives no importable \`${m}\``,
      ),
    ]
  })
  for (const problem of problems) {
    console.error(problem)
  }
  console.log(
    problems.length
      ? `${problems.length} problem(s) in ${entries.length} entries`
      : `all ${entries.length} conda and pip entries deliver their commands`,
  )
  process.exitCode = problems.length ? 1 : 0
}

const [action, prefixArg] = process.argv.slice(2)
if (!prefixArg || (action !== 'create' && action !== 'check')) {
  throw new Error(
    'usage: node scripts/tutorial-tools-env.ts create|check <prefix>',
  )
}
const prefix = path.resolve(prefixArg)
if (action === 'create') {
  create(prefix)
}
check(prefix)
