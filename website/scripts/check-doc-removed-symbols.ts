// Fails when an agent-doc names a symbol that used to be ours and no longer is.
// check-doc-imports exempts these docs because most of the names they carry were
// never ours; asking "did we delete this" instead of "does this exist" separates
// the drift from the outside world without an allowlist.
//
// History is sampled, not walked: a name only has to appear in SOME rung between
// its birth and its death. A rung this checkout cannot resolve is skipped.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

import {
  BUILD_DIRS,
  docFiles,
  reportProblems,
  walkFiles,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

// `mechanisms/` joins because its premise is that this repo's code is the
// evidence, which makes every name it cites a claim about current code.
// `ideas/` (proposed names), `architecture-decision-records/` (superseded ones
// on purpose) and `handoffs/` do not.
const DOC_DIRS = ['reference', 'mechanisms'].map(d =>
  join(repoRoot, 'agent-docs', d),
)

// Must stay in step with check-doc-imports' TICKED_SYMBOL and its source-side
// twin: this asks a narrower question about the same names.
const TICKED_SYMBOL =
  /`([A-Z][A-Za-z0-9]{4,}|[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)[`(]/g
const BARE_SYMBOL =
  /\b(?:[A-Z][A-Za-z0-9]{4,}|[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g

const PLACEHOLDER = /^My[A-Z]|Xxx/

const SCAN_ROOTS = [
  'packages',
  'plugins',
  'products',
  'scripts',
  'website/scripts',
]

// Wider than check-doc-imports' source set: this half only ever suppresses a
// report, and `chrName` is live in the Python inside a `.sh`.
const isSource = (name: string) =>
  /\.(tsx?|jsx?|mjs|cjs|slang|sh|py)$/.test(name)

// Docs whose subject is what is gone, exempt as documents rather than one entry
// per name.
const ABSENCE_DOCS = new Set([
  'HISTORICAL.md',
  'REJECTED_IDEAS.md',
  'PLUGIN_ABI_STABILITY.md',
])

// A name a doc means to say is gone, or that left for another repo. The entry
// asserts the sentence around it is still true.
const ABSENT_ON_PURPOSE = new Map([
  ['beginUpload', 'GPU_RENDERING names the retired upload transaction'],
  ['endUpload', 'GPU_RENDERING, the same sentence'],
  ['retainRegion', 'GPU_RENDERING, the same sentence'],
  [
    'readCachedConfig',
    'CONFIG_PATTERN lists it under what the pattern dropped',
  ],
  [
    'stopIndex',
    'BAM_STACK_INTEGRATION names a monotone chunk index as a concept, not a symbol',
  ],
  ['regionStatuses', 'PROGRESS_REPORTING names the implementation it replaced'],
  ['setRegionStatus', 'PROGRESS_REPORTING, the same sentence'],
  [
    'TrackRowWithOverlay',
    'EXAMPLES_SITES names a version an example site renamed',
  ],
  [
    'joinChunk',
    'NETWORK_ABORT — the retry lives in @gmod/range-cache-filehandle',
  ],
  [
    'warnIfMidFrame',
    "GPU_RENDERING names the warning WebGPUHal's deferred destroy replaced",
  ],
  ['cacheIdleTimeoutMs', 'an upstream option deliberately not plumbed'],
  ['Client', 'BAM_STACK_INTEGRATION names @gmod/bam types'],
  ['DiagonalizeRpcBase', 'a base class that left the plugin ABI'],
  ['filterPaf', 'DEMO_DATASETS names a step in SVbyEye'],
  [
    'ERR_INSUFFICIENT_RESOURCES',
    "TEST_INFRASTRUCTURE quotes Chrome's own error",
  ],
  [
    'MiniControlsComponent',
    'EAGER_BUNDLE names the view method whose deletion was the fix',
  ],
])

const LADDER = ['~128', '~512', '~2048']

function resolves(rev: string) {
  try {
    execFileSync(
      'git',
      // `^{commit}` is git's peel syntax, not a broken `${...}` — the rule
      // cannot tell them apart, and spelling the peel around the interpolation
      // to dodge it would be worse to read than saying so here.
      // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation
      ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`],
      {
        cwd: repoRoot,
        stdio: 'ignore',
      },
    )
    return true
  } catch {
    return false
  }
}

function revs() {
  const base = ['main', 'origin/main'].find(r => resolves(r))
  const tags = execFileSync(
    'git',
    ['tag', '--list', 'v*', '--sort=-version:refname'],
    { cwd: repoRoot, encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean)
  return [
    ...(base ? LADDER.map(step => `${base}${step}`) : []),
    ...tags.slice(0, 1),
  ].filter(r => resolves(r))
}

// Lines rather than `-o` matches: git's `-o` reports one hit per line and would
// drop the second candidate wherever two share one. Pathspecs are filtered to
// what the rev has, since one missing path fails the whole grep.
function namesPresentIn(rev: string, candidates: Set<string>) {
  const found = new Set<string>()
  const paths = SCAN_ROOTS.filter(p => {
    try {
      execFileSync('git', ['cat-file', '-e', `${rev}:${p}`], {
        cwd: repoRoot,
        stdio: 'ignore',
      })
      return true
    } catch {
      return false
    }
  })
  try {
    const out = execFileSync(
      'git',
      ['grep', '-h', '-F', '-f', '-', rev, '--', ...paths],
      {
        cwd: repoRoot,
        input: [...candidates].join('\n'),
        encoding: 'utf8',
        maxBuffer: 1 << 28,
      },
    )
    for (const m of out.matchAll(BARE_SYMBOL)) {
      if (candidates.has(m[0])) {
        found.add(m[0])
      }
    }
  } catch {
    // git grep exits 1 on no match, which is an answer rather than a failure.
  }
  return found
}

// Comments included, unlike check-doc-imports' set. Stripping them is more
// correct and much noisier here: the history side greps raw text, so a name that
// only ever lived in our comments would read as one we deleted. The asymmetry
// costs missed reports, never false ones. This file is excluded because its own
// allowlist would otherwise whitelist every name in it.
function liveSymbols() {
  const live = new Set<string>()
  const self = join(repoRoot, 'website/scripts/check-doc-removed-symbols.ts')
  const add = (file: string) => {
    for (const m of readFileSync(file, 'utf8').matchAll(BARE_SYMBOL)) {
      live.add(m[0])
    }
  }
  for (const root of SCAN_ROOTS) {
    for (const file of walkFiles(join(repoRoot, root), isSource, BUILD_DIRS)) {
      if (file !== self) {
        add(file)
      }
    }
  }
  for (const name of readdirSync(repoRoot)) {
    const file = join(repoRoot, name)
    if ((isSource(name) || name.endsWith('.json')) && statSync(file).isFile()) {
      add(file)
    }
  }
  return live
}

function main() {
  const cited = new Map<string, string[]>()
  for (const doc of DOC_DIRS.flatMap(dir => docFiles(dir))) {
    if (!ABSENCE_DOCS.has(basename(doc))) {
      readFileSync(doc, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(TICKED_SYMBOL)) {
            const symbol = m[1]!
            if (!PLACEHOLDER.test(symbol) && !ABSENT_ON_PURPOSE.has(symbol)) {
              cited.set(symbol, [
                ...(cited.get(symbol) ?? []),
                `${relative(repoRoot, doc)}:${i + 1}`,
              ])
            }
          }
        })
    }
  }

  const live = liveSymbols()
  const absent = new Set([...cited.keys()].filter(name => !live.has(name)))
  const rungs = revs()
  const wasOurs = new Set(
    rungs.flatMap(rev => [...namesPresentIn(rev, absent)]),
  )

  const problems = [...wasOurs]
    .sort()
    .flatMap(name =>
      cited
        .get(name)!
        .map(
          where =>
            `  ${where}\n    ${name}\n    → we deleted this. Name what replaced ` +
            `it, or add it to ABSENT_ON_PURPOSE with the reason.`,
        ),
    )

  reportProblems(
    problems,
    `no agent-doc names a symbol we deleted (${absent.size} absent names ` +
      `against ${rungs.length} history rungs: ${rungs.join(', ')})`,
  )
}

main()
