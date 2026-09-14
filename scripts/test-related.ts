/**
 * Run the jest suites that executed a file this branch changed.
 *
 * Every jest run records a footprint per suite — the repo files it loaded
 * (`config/jest/footprints.cjs`) — and a suite is selected when its footprint
 * holds a changed file. The static import graph (`--findRelatedTests`) is only
 * the fallback for a suite with no footprint yet, because it cannot
 * discriminate: every jbrowse-web suite imports `corePlugins`, so statically
 * each one is related to nearly every plugin file.
 *
 * A changed file whose compiled output is unchanged — comments, types,
 * formatting — selects nothing.
 *
 * Usage: `pnpm test-related [base-ref]` (default `main`). Extra jest flags pass
 * through after `--`.
 */
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import readline from 'node:readline'

import { transformSync } from '@babel/core'

import { changedFiles, git, lines } from './changedFiles.ts'

const { readFootprints } = createRequire(import.meta.url)(
  '../config/jest/footprints.cjs',
) as {
  readFootprints: (
    cacheDirectory: string,
    checkoutRoots: string[],
  ) => Map<string, Set<string>>
}

const CODE = /\.(ts|tsx|js|jsx|cjs|mjs)$/
const JSX = /\.(tsx|jsx|js)$/
const TEST = /\.test\.(ts|tsx|js|jsx)$/
const NOT_A_SUITE = /(^|\/)(dist|demos)\/|^products\/aws\//
// Loaded by jest itself or resolved outside the repo, so in no footprint, and
// a change to any of them can move every suite.
const HARNESS =
  /^(jest\.config\.js|babel\.config\.cjs|pnpm-lock\.yaml|config\/jest\/)/

const argv = process.argv.slice(2)
const passThroughAt = argv.indexOf('--')
const jestArgs = passThroughAt === -1 ? [] : argv.slice(passThroughAt + 1)
const own = passThroughAt === -1 ? argv : argv.slice(0, passThroughAt)
const flags = own.filter(a => a.startsWith('-'))
if (flags.length > 0) {
  console.error(
    `Unknown option ${flags.join(' ')}. Jest flags go after \`--\`.`,
  )
  process.exit(2)
}
const ref = own[0] ?? 'main'

const root = git('rev-parse', '--show-toplevel').trim()
const primary = path.dirname(
  path.resolve(root, git('rev-parse', '--git-common-dir').trim()),
)
process.chdir(root)
const { base, files: changed } = changedFiles(ref)
if (changed.length === 0) {
  console.log(`Nothing changed against ${ref}.`)
  process.exit(0)
}

function compiled(source: string, file: string) {
  try {
    return transformSync(source, {
      filename: path.join(root, file),
      babelrc: false,
      configFile: false,
      presets: ['@babel/preset-typescript'],
      parserOpts: { plugins: JSX.test(file) ? ['jsx'] : [] },
      comments: false,
      compact: true,
      sourceMaps: false,
    })?.code
  } catch {
    return undefined
  }
}

function compilesUnchanged(file: string) {
  if (!CODE.test(file) || !fs.existsSync(file)) {
    return false
  }
  let before: string
  try {
    before = git('show', `${base}:${file}`)
  } catch {
    return false
  }
  const after = compiled(fs.readFileSync(file, 'utf8'), file)
  return after !== undefined && after === compiled(before, file)
}

const harness = changed.filter(f => HARNESS.test(f))
const inert = changed.filter(compilesUnchanged)
const live = changed.filter(f => !inert.includes(f))

const footprints = readFootprints(
  path.join(primary, 'node_modules/.cache/jest'),
  [root, primary],
)

const selected = new Set(live.filter(f => TEST.test(f) && fs.existsSync(f)))
const liveSources = live.filter(f => !TEST.test(f))
let byFootprint = 0
for (const [test, files] of footprints) {
  if (
    !selected.has(test) &&
    fs.existsSync(test) &&
    liveSources.some(f => files.has(f))
  ) {
    selected.add(test)
    byFootprint++
  }
}

const unrecorded = lines(git('ls-files', '*.test.*')).filter(
  f => TEST.test(f) && !NOT_A_SUITE.test(f) && !footprints.has(f),
)
const staticInputs = liveSources.filter(
  f => fs.existsSync(f) && (CODE.test(f) || f.endsWith('.json')),
)
let byGraph = 0
if (unrecorded.length > 0 && staticInputs.length > 0) {
  const missing = new Set(unrecorded)
  const related = lines(
    execFileSync(
      'npx',
      ['jest', '--listTests', '--findRelatedTests', ...staticInputs],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ),
  )
  for (const abs of related) {
    const test = path.relative(root, abs)
    if (missing.has(test) && !selected.has(test)) {
      selected.add(test)
      byGraph++
    }
  }
}

const byChange = selected.size - byFootprint - byGraph
console.log(
  `${changed.length} changed file(s) against ${ref}, ${inert.length} compiling to identical output`,
)
if (harness.length > 0) {
  console.log(`Every suite, for the test harness: ${harness.join(', ')}`)
} else {
  console.log(
    `${selected.size} suite(s): ${byFootprint} by footprint, ${byGraph} by the static graph (${unrecorded.length} have no footprint yet), ${byChange} changed test file(s)`,
  )
  if (selected.size === 0) {
    process.exit(0)
  }
}

// `--runTestsByPath` ends with a "Ran all test suites within paths" line naming
// every path, which is kilobytes of noise in an agent's context.
const FOOTER = 'Ran all test suites within paths '

const child = spawn(
  'npx',
  [
    'jest',
    '--ci',
    ...(harness.length > 0 ? [] : ['--runTestsByPath', ...selected]),
    ...jestArgs,
  ],
  { stdio: ['inherit', 'inherit', 'pipe'] },
)
for await (const line of readline.createInterface({ input: child.stderr })) {
  if (!line.startsWith(FOOTER)) {
    process.stderr.write(`${line}\n`)
  }
}
const code = await new Promise<number>(resolve => {
  child.on('close', c => {
    resolve(c ?? 1)
  })
})
process.exit(code)
