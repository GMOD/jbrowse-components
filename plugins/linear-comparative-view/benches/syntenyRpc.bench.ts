// What does the whole synteny worker cost over an MCScan track, before and
// after a change to it?
//
//   node --expose-gc plugins/linear-comparative-view/benches/syntenyRpc.bench.ts
//   node --expose-gc plugins/linear-comparative-view/benches/syntenyRpc.bench.ts --base=HEAD~1
//   node --expose-gc plugins/linear-comparative-view/benches/syntenyRpc.bench.ts --rounds=40
//
// `--expose-gc` is not optional — see THE ARM ORDER ROTATES, below. Without it
// the control reads ~0.90x and the run has measured nothing.
//
// The per-mechanism benches next door price one function each. This one prices
// the RPC a pan actually calls, which is the number a release note is making a
// claim about — and the only one that can show a mechanism-level win being eaten
// somewhere else in the pipeline.
//
// Read `agent-docs/reference/BENCHMARKING.md` first.
//
// TWO BUNDLES IN ONE PROCESS. esbuild bundles `syntenyRpcDriver.ts` twice: once
// against the working tree and once with every file that differs from `--base`
// served from that ref. Both bundles are then imported into THIS process and
// interleaved round-robin, which is the interleaving rule — two processes would
// put any drift in machine state entirely on whichever ran second.
//
// Bundling is not optional here. The driver reaches `PluginManager`, which pulls
// in `.tsx`, and node's type stripping does not do JSX; it is also what the
// benchmarking doc prescribes for a worker-side question, since jest inflates
// typed-array loops by 6-30x non-uniformly.
//
// THE CONTROL IS A THIRD BUNDLE: the working tree, bundled a second time to a
// different file, so it is separately loaded and separately optimized. Whatever
// it scores against the working tree is what this harness can resolve, and a row
// whose control is far from 1.00 measured nothing.
//
// THE ARM ORDER ROTATES PER ROUND. Fixed order put the control — always third —
// at a steady 0.88-0.95x across every run: an arm running last in a round
// absorbs the GC the two before it queued, which is a position effect and not
// anything about the code. Rotating puts each arm first, second and last in
// turn, and the control comes back to 0.97-1.01x.
//
// TWO SHAPES, and they are different questions. `whole genome` is the view at
// its opening zoom, where the region count is what dominates. `one locus` is a
// pan or a zoom — one region per axis, on every frame. A shape that emits no
// features proves nothing, so the row prints its count: `one locus` deliberately
// pairs grape chr1 with the peach window it is syntenic to, since the obvious
// Pp01 0-8Mb holds none of that pair's 902 anchors.
//
// Measured 1.15-1.31x on `whole genome` against controls of 0.98-1.10x, on a
// box under load from other agents. `one locus` did not settle there — 1.08x to
// 1.84x with controls from 0.67x to 1.01x — so it wants a quiet machine before
// anyone quotes it. The per-mechanism benches in
// `plugins/comparative-adapters/benches/` hold up much better under contention,
// which is the usual trade: this one is the number that matters and the one
// hardest to measure.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { build } from 'esbuild'

import type { Shape } from './syntenyRpcDriver.ts'
import type { Region } from '@jbrowse/core/util'

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.split('=')[1] ?? 15,
)
const base =
  process.argv.find(a => a.startsWith('--base='))?.split('=')[1] ?? 'HEAD~1'
const allowDiff = process.argv.includes('--allow-diff')

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()
const driver = new URL('./syntenyRpcDriver.ts', import.meta.url).pathname

// Every source file the working tree changed against `base`. Serving these from
// `base` is what makes the second bundle "the worker as it was" without a second
// checkout — and it is exact: a file that did not change is byte-identical in
// both bundles, so nothing but the change under test differs.
const changed = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=M', base, '--', '*.ts', '*.tsx'],
  { encoding: 'utf8', cwd: repoRoot },
)
  .split('\n')
  .filter(Boolean)

function baseVersion(path: string) {
  return execFileSync('git', ['show', `${base}:${path}`], {
    encoding: 'utf8',
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
  })
}

// esbuild resolves and loads by absolute path, so the override set is keyed the
// same way
const overrides = new Map(
  changed.map(path => [join(repoRoot, path), baseVersion(path)] as const),
)

process.env.JB_REPO_ROOT = repoRoot

const outDir = mkdtempSync(join(tmpdir(), 'synteny-rpc-bench-'))

async function bundle(name: string, useBase: boolean) {
  const outfile = join(outDir, `${name}.mjs`)
  await build({
    entryPoints: [driver],
    bundle: true,
    outfile,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    logLevel: 'error',
    plugins: useBase
      ? [
          {
            name: 'serve-from-base',
            setup(pluginBuild) {
              pluginBuild.onLoad({ filter: /\.tsx?$/ }, args => {
                const contents = overrides.get(args.path)
                return contents === undefined
                  ? undefined
                  : { contents, loader: args.path.endsWith('x') ? 'tsx' : 'ts' }
              })
            },
          },
        ]
      : [],
  })
  return outfile
}

const [afterPath, beforePath, controlPath] = await Promise.all([
  bundle('after', false),
  bundle('before', true),
  bundle('control', false),
])

// a shim per bundle so each import specifier is distinct and no two share a
// module instance
const load = async (path: string) => {
  const shim = join(outDir, `${Math.random().toString(36).slice(2)}.mjs`)
  writeFileSync(shim, `export * from ${JSON.stringify(path)}\n`)
  return import(shim)
}

const after = await load(afterPath)
const before = await load(beforePath)
const control = await load(controlPath)

const grapeRefs = [
  'chr1',
  'chr2',
  'chr3',
  'chr4',
  'chr5',
  'chr6',
  'chr7',
  'chr8',
  'chr9',
  'chr10',
  'chr11',
  'chr12',
  'chr13',
  'chr14',
  'chr15',
  'chr16',
  'chr17',
  'chr18',
  'chr19',
]
const peachRefs = [
  'Pp01',
  'Pp02',
  'Pp03',
  'Pp04',
  'Pp05',
  'Pp06',
  'Pp07',
  'Pp08',
]
const region = (
  refName: string,
  assemblyName: string,
  end: number,
  start = 0,
): Region => ({ refName, start, end, assemblyName })

const shapes: [string, Shape][] = [
  [
    'whole genome',
    {
      queryRegions: grapeRefs.map(r => region(r, 'grape', 60_000_000)),
      targetRegions: peachRefs.map(r => region(r, 'peach', 60_000_000)),
      width: 1000,
    },
  ],
  [
    // The two windows a synteny launch lands on: grape chr1 against the peach
    // Pp01 block it is syntenic to, which is 902 anchors over 22.4-32.5 Mb.
    // Pp01 0-8Mb — the obvious-looking choice — holds none of them, and a shape
    // that emits nothing goes on timing the walk while proving nothing.
    'one locus',
    {
      queryRegions: [region('chr1', 'grape', 24_000_000)],
      targetRegions: [region('Pp01', 'peach', 33_000_000, 22_000_000)],
      width: 1000,
    },
  ],
]

console.log(
  `base ${base} — ${changed.length} changed file(s) served from it\n` +
    `${changed.map(f => `  ${f}`).join('\n')}\n`,
)

for (const [label, shape] of shapes) {
  // warm every arm the same way, and check identity before believing any timing
  const expected = await before.runSyntenyRpc(shape)
  const gotAfter = await after.runSyntenyRpc(shape)
  const gotControl = await control.runSyntenyRpc(shape)
  const describe = (got: { featureIds: string[] }) =>
    JSON.stringify(got.featureIds) === JSON.stringify(expected.featureIds)
      ? undefined
      : `${expected.featureIds.length} vs ${got.featureIds.length} features` +
        (expected.featureIds.length === got.featureIds.length
          ? `, first differing id ${expected.featureIds.find((id: string, i: number) => id !== got.featureIds[i])}`
          : '')
  const diffAfter = describe(gotAfter)
  const diffControl = describe(gotControl)
  if ((diffAfter ?? diffControl) !== undefined) {
    const message = `${label}: after ${diffAfter ?? 'ok'}, control ${diffControl ?? 'ok'}`
    if (!allowDiff) {
      throw new Error(`${message} (pass --allow-diff if deliberate)`)
    }
    console.log(`DIFF ${message}`)
  }

  const best = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ]
  for (let round = 0; round < rounds; round++) {
    for (let slot = 0; slot < 3; slot++) {
      // rotate, so no arm is always the one that runs last in a round
      const arm = (round + slot) % 3
      // Hand every arm the same heap. Without it the control sat at a steady
      // 0.88-0.95x at default GC settings — an arm inherits whatever the one
      // before it left for the collector, and three whole-genome fetches per
      // round is enough garbage for that to be worth 10%. Rotating the arm order
      // did not fix it; only a full collection between arms does. Its own
      // allocation still shows, since a fetch's nursery collections happen
      // inside its own timed region.
      globalThis.gc?.()
      const t = performance.now()
      if (arm === 0) {
        await before.runSyntenyRpc(shape)
      } else if (arm === 1) {
        await after.runSyntenyRpc(shape)
      } else {
        await control.runSyntenyRpc(shape)
      }
      best[arm] = Math.min(best[arm]!, performance.now() - t)
    }
  }
  const [bestBefore, bestAfter, bestControl] = best as [number, number, number]

  console.log(
    `${label} — ${shape.queryRegions.length}+${shape.targetRegions.length} regions, ${expected.featureIds.length} features\n` +
      `  ${base} (baseline)   ${bestBefore.toFixed(2)}ms\n` +
      `  working tree        ${bestAfter.toFixed(2)}ms  ${(bestBefore / bestAfter).toFixed(2)}x\n` +
      `  working tree (ctrl) ${bestControl.toFixed(2)}ms  ${(bestAfter / bestControl).toFixed(2)}x`,
  )
}

// the bundles are megabytes apiece and /tmp here is a quota'd tmpfs
rmSync(outDir, { recursive: true, force: true })
