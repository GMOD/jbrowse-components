// What a `.tai` reader (`BgzipMafAdapter`'s MAF, `BgzipTaffyAdapter`'s TAF)
// costs over a decompressed slice whose blocks mostly fall outside the query,
// as a slice starting at the `.tai` entry before a narrow query's start does,
// before and after a change to it.
//
//   node --expose-gc plugins/maf/benches/taiReadBlocks.bench.ts
//   node --expose-gc plugins/maf/benches/taiReadBlocks.bench.ts --base=HEAD~1 --rounds=30
//
// Flags: --base=<ref> (default main), --rounds=<n> (default 20), --allow-diff,
// --only=<fixture> (what the parent hands each child).
//
// Read `agent-docs/reference/BENCHMARKING.md` first. The shape is
// `plugins/linear-comparative-view/benches/syntenyRpc.bench.ts`'s: esbuild
// bundles `taiReadBlocksDriver.ts` against the working tree, again with every
// file that differs from `--base` served from that ref, and a third time as the
// control; the arms interleave with the order rotated and a full collection
// before each, and the MIN across rounds is the number. Each fixture runs in
// its own process, since one dataset's JIT state contaminates the next.
// Every block a reader emits is compared across the arms before any timing.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { build } from 'esbuild'

import { mafSliceText, sliceQuery, tafSliceText } from './taiSliceFixture.ts'

import type * as Driver from './taiReadBlocksDriver.ts'
import type { TaiSliceSpec } from './taiSliceFixture.ts'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const rounds = Number(flag('rounds') ?? 20)
const base = flag('base') ?? 'main'
const only = flag('only')
const allowDiff = process.argv.includes('--allow-diff')

const SHAPES: Record<string, TaiSliceSpec> = {
  '26 species, 4000 blocks of 20 columns': {
    species: 26,
    columns: 20,
    blocks: 4000,
    spacing: 30,
    queryBlocks: [1900, 2100],
    seed: 1,
  },
  '470 species, 600 blocks of 60 columns': {
    species: 470,
    columns: 60,
    blocks: 600,
    spacing: 80,
    queryBlocks: [285, 315],
    seed: 2,
  },
}
const FORMATS = ['maf', 'taf']
const fixtures = Object.keys(SHAPES).flatMap(shape =>
  FORMATS.map(format => `${format}: ${shape}`),
)

if (only === undefined) {
  for (const fixture of fixtures) {
    execFileSync(
      process.execPath,
      [
        ...process.execArgv,
        import.meta.filename,
        ...process.argv.slice(2),
        `--only=${fixture}`,
      ],
      { stdio: 'inherit' },
    )
  }
} else {
  await runFixture(only)
}

async function runFixture(fixture: string) {
  const [format, shape] = fixture.split(': ') as [string, string]
  const spec = SHAPES[shape]
  if (!spec || !FORMATS.includes(format)) {
    throw new Error(`no fixture ${fixture}; one of ${fixtures.join(' | ')}`)
  }
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim()
  const driver = new URL('./taiReadBlocksDriver.ts', import.meta.url).pathname
  const changed = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=M', base, '--', '*.ts', '*.tsx'],
    { encoding: 'utf8', cwd: repoRoot },
  )
    .split('\n')
    .filter(Boolean)
  const overrides = new Map(
    changed.map(
      path =>
        [
          join(repoRoot, path),
          execFileSync('git', ['show', `${base}:${path}`], {
            encoding: 'utf8',
            cwd: repoRoot,
            maxBuffer: 64 * 1024 * 1024,
          }),
        ] as const,
    ),
  )
  const outDir = mkdtempSync(join(tmpdir(), 'tai-read-blocks-bench-'))
  const bundle = async (name: string, fromBase: boolean) => {
    const outfile = join(outDir, `${name}.mjs`)
    await build({
      entryPoints: [driver],
      bundle: true,
      outfile,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      logLevel: 'error',
      banner: {
        js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url); // ${name}`,
      },
      plugins: fromBase
        ? [
            {
              name: 'serve-from-base',
              setup(pluginBuild) {
                pluginBuild.onLoad({ filter: /\.tsx?$/ }, args => {
                  const contents = overrides.get(args.path)
                  return contents === undefined
                    ? undefined
                    : {
                        contents,
                        loader: args.path.endsWith('x') ? 'tsx' : 'ts',
                      }
                })
              },
            },
          ]
        : [],
    })
    const arm: typeof Driver = await import(outfile)
    return arm
  }
  const baseArm = await bundle('base', true)
  const branchArm = await bundle('branch', false)
  const controlArm = await bundle('control', false)
  const arms = [baseArm, branchArm, controlArm]
  const text = format === 'maf' ? mafSliceText(spec) : tafSliceText(spec)
  const query = sliceQuery(spec)
  const record = format === 'maf' ? 'recordMaf' : 'recordTaf'
  const count = format === 'maf' ? 'countMaf' : 'countTaf'

  const expected = baseArm[record](text, query)
  for (const [name, arm] of Object.entries({
    branch: branchArm,
    control: controlArm,
  })) {
    if (arm[record](text, query) !== expected) {
      const message = `${fixture}: ${name} emits other blocks than ${base}`
      if (!allowDiff) {
        throw new Error(`${message} (pass --allow-diff if deliberate)`)
      }
      console.log(`DIFF ${message}`)
    }
  }
  const [emitted] = arms.map(arm => arm[count](text, query))
  if (!emitted?.blocks) {
    throw new Error(`${fixture}: the query keeps no block`)
  }

  const gc = (globalThis as { gc?: () => void }).gc
  const best = [Infinity, Infinity, Infinity]
  for (let round = 0; round < rounds; round++) {
    for (let slot = 0; slot < 3; slot++) {
      const arm = (round + slot) % 3
      gc?.()
      const t = performance.now()
      arms[arm]![count](text, query)
      best[arm] = Math.min(best[arm]!, performance.now() - t)
    }
  }
  const [bestBase, bestBranch, bestControl] = best as [number, number, number]
  console.log(
    `${fixture} — ${emitted.blocks} of ${spec.blocks} blocks kept, ${emitted.rows} rows, ${(text.length / 1e6).toFixed(1)}MB of text\n` +
      `  ${base} (baseline)    ${bestBase.toFixed(2)}ms\n` +
      `  working tree         ${bestBranch.toFixed(2)}ms  ${(bestBranch / bestBase).toFixed(2)}x\n` +
      `  working tree (ctrl)  ${bestControl.toFixed(2)}ms  ${(bestControl / bestBranch).toFixed(2)}x`,
  )
  rmSync(outDir, { recursive: true, force: true })
}
