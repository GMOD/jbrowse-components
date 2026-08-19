// Fails when a workspace package declares a `typescript` outside the 6.x line
// the toolchain is built on, or when the `typescript7` alias stops pointing at
// 7.x. `agent-docs/reference/TOOLCHAIN.md` says why the two versions are split.
//
// A dep bump moved root, website and the four examples-sites from ^6.0.3 to
// ^7.0.2 in one commit. TypeScript 7's package entry is a stub —
// `require('typescript')` yields `{version, versionMajorMinor}` and nothing
// else — so everything reading the compiler API through the ambient install
// broke at once: typescript-eslint crashed on load, the api-docs and
// display-chrome generators died on `ts.createProgram is not a function`, and
// oxlint's type-aware pass read every `ts.Node` as an error type. The follow-up
// fix caught root and left the other five, because the rule was prose about
// "the ambient typescript" rather than a check over every package declaring one.
//
// Run: pnpm check-typescript-pin
import { globSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')
const workspace = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')
const globs = /^packages:\n((?:[ #].*\n|\n)*)/m
  .exec(workspace)![1]!
  .split('\n')
  .map(line => /^\s+-\s+'(.+)'\s*$/.exec(line)?.[1])
  .filter(pattern => pattern !== undefined)

const manifests = [
  'package.json',
  ...globs.flatMap(pattern =>
    globSync(`${pattern}/package.json`, { cwd: root }),
  ),
]

const problems: string[] = []
for (const manifest of manifests) {
  const pkg = JSON.parse(readFileSync(join(root, manifest), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const where = relative('.', join(root, manifest))
  if (deps.typescript !== undefined && !/^\^?6\./.test(deps.typescript)) {
    problems.push(
      `${where}: typescript is "${deps.typescript}", must stay on 6.x`,
    )
  }
  if (
    deps.typescript7 !== undefined &&
    !/^npm:typescript@\^?7\./.test(deps.typescript7)
  ) {
    problems.push(
      `${where}: typescript7 is "${deps.typescript7}", must alias typescript 7.x`,
    )
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  console.error(
    '\nSee agent-docs/reference/TOOLCHAIN.md for why the versions are split.',
  )
  process.exit(1)
}
console.log(`typescript pin ok across ${manifests.length} workspace manifests`)
