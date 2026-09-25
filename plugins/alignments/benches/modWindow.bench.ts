// What bounding the modification extract's walks to the fetched region saves.
//
//   node --expose-gc --experimental-transform-types --no-warnings plugins/alignments/benches/modWindow.bench.ts
//
// Flags: --rounds=<n> (default 15), --bam=<dir>, --refName, --base=<ref>
// (default 3713513c33, the last commit whose extract walked whole reads),
// --widths=<a,b,..|contig> (default 1000,10000,50000,contig), --only=<width>,
// --mode=marks|fill (default marks)
//
// `extractModifications` emits only the calls inside the region, but it used
// to find them by running the MM delta walk and the CIGAR walk over every read
// end to end. It now maps the region to read offsets first, tallies the bases
// on the read's 5' side of the window instead of placing calls there, and
// stops at the far edge.
//
// Arms, interleaved per round, min of rounds, extract only — what follows it
// is identical by the identity check:
//   old      — `extract.ts` and the two packages it walks with, checked out at
//              --base
//   bounded  — the working tree
//   control  — a second checkout of --base, separately loaded
//
// Before timing, bounded's marks and the old arm's must be identical to each
// other and to the old arm's whole-read marks cut to the region, and the
// fill-unmarked view (which reads the extract's positions back through
// `extractMethylation`) must be identical between old and bounded.
//
// ONE PROCESS PER WIDTH. The parent spawns a child per width, because each
// width is a different read set and running several through the same arm
// functions contaminates every one after the first (BENCHMARKING.md).
//
// 2026-09-25, `200x.longread.mod.bam` around chr22_mask:200,000 (contig is
// chr22_mask:1-400000, the file's full extent), 15 rounds, load ~5-12, ms:
//
//   --mode=marks  width  reads    marks     old  bounded  old/bounded  control/old
//                  1000    253    1,690   151.7     26.7        5.68x         0.99
//                 10000    289   36,985   167.9     54.4        3.09x         1.06
//                 50000    375  128,026   188.7    121.2        1.56x         1.00
//                contig   1037  528,822   622.0    596.6        1.04x         1.02
//
//   --mode=fill   width  reads    marks     old  bounded  old/bounded  control/old
//                  1000    253    2,314   190.5     40.3        4.73x         1.00
//                 10000    289   52,520   275.3    143.3        1.92x         1.00
//                 50000    375  182,358   660.7    570.9        1.16x         0.99
//                contig   1037  755,151  2366.5   2369.3        1.00x         1.00
//
// (the fill contig row is the second of two `--only=contig --rounds=20` reruns
// of a first run that read 0.99x; both reruns read 1.00x)
//
// Before this bench measured the walks it measured the emission cut, window
// against whole-read over extract plus everything downstream, at 2.6-2.75x for
// 1-10 kb views: `git show 51d50af58d:plugins/alignments/benches/modWindow.bench.ts`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { BamFile } from '@gmod/bam'

import BamSlightlyLazyFeature from '../src/BamAdapter/BamSlightlyLazyFeature.ts'
import {
  extractMethylation,
  extractModifications,
} from '../src/features/modification/extract.ts'
import { getStrand } from '../src/shared/util.ts'

import type { ColorBy } from '../src/shared/types.ts'
import type { ModificationEntry } from '../src/shared/webglRpcTypes.ts'
import type { Region } from '@jbrowse/core/util'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '15'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const REFNAME = arg('refName', 'chr22_mask')
const BASE = arg('base', '3713513c33')
const WIDTHS = arg('widths', '1000,10000,50000,contig').split(',')
const ONLY = arg('only', '')
const MODE = arg('mode', 'marks')
const CENTER = 200000
const CONTIG = { start: 0, end: 400000 }

const HEADER =
  ' width  reads     Mbp    marks      old  bounded  control  old/bounded  control/old'

if (!ONLY) {
  console.log(HEADER)
  for (const width of WIDTHS) {
    execFileSync(
      process.execPath,
      [
        ...process.execArgv,
        import.meta.filename,
        ...process.argv.slice(2),
        `--only=${width}`,
      ],
      { stdio: 'inherit' },
    )
  }
  process.exit(0)
}

const root = join(import.meta.dirname, '..', '..', '..')

// The extract and both packages it walks with, so the old arm is the old path
// end to end rather than old `extract.ts` over the working tree's walks.
const REDIRECTED = new Map([
  ['@jbrowse/cigar-utils', 'packages/cigar-utils'],
  ['@jbrowse/modifications-utils', 'packages/modifications-utils'],
])
const checkouts: string[] = []

registerHooks({
  resolve(specifier, context, nextResolve) {
    const pkg = REDIRECTED.get(specifier)
    const parent = context.parentURL
    if (pkg !== undefined && parent !== undefined) {
      const dir = checkouts.find(d =>
        parent.startsWith(pathToFileURL(`${d}/`).href),
      )
      if (dir !== undefined) {
        return {
          url: pathToFileURL(join(dir, pkg, 'src/index.ts')).href,
          shortCircuit: true,
        }
      }
    }
    return nextResolve(specifier, context)
  },
})

function checkout(ref: string) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'jb-modwindow-')))
  const pkgs = ['plugins/alignments', ...REDIRECTED.values()]
  const tar = execFileSync(
    'git',
    [
      'archive',
      ref,
      '--',
      ...pkgs.flatMap(p => [`${p}/src`, `${p}/package.json`]),
    ],
    { cwd: root, maxBuffer: 1 << 28, encoding: 'buffer' },
  )
  execFileSync('tar', ['-x', '-C', dir], { input: tar })
  for (const p of ['plugins/alignments', 'packages/modifications-utils']) {
    symlinkSync(join(root, p, 'node_modules'), join(dir, p, 'node_modules'))
  }
  checkouts.push(dir)
  return dir
}

interface Arm {
  extract: typeof extractModifications
  methylation: typeof extractMethylation
}

async function loadOld(ref: string): Promise<Arm> {
  const dir = checkout(ref)
  const mod: object = await import(
    join(dir, 'plugins/alignments/src/features/modification/extract.ts')
  )
  if (
    !('extractModifications' in mod) ||
    typeof mod.extractModifications !== 'function' ||
    !('extractMethylation' in mod) ||
    typeof mod.extractMethylation !== 'function'
  ) {
    throw new Error(`${ref} has no extractModifications/extractMethylation`)
  }
  return {
    extract: mod.extractModifications as Arm['extract'],
    methylation: mod.extractMethylation as Arm['methylation'],
  }
}

const marksColorBy: ColorBy = {
  type: 'modifications',
  modifications: { threshold: 50 },
}
const fillColorBy: ColorBy = {
  type: 'modifications',
  modifications: { fillUnmarked: true },
}
const colorBy = MODE === 'fill' ? fillColorBy : marksColorBy
const ON_REF = { assemblyName: 'bench', refName: REFNAME }
const WHOLE: Region = { ...ON_REF, start: 0, end: Number.MAX_SAFE_INTEGER }

interface Reads {
  features: BamSlightlyLazyFeature[]
  strands: (-1 | 0 | 1)[]
}

// Three drivers written out longhand, deliberately: one shared driver makes the
// extract call site polymorphic across arms (BENCHMARKING.md).
function driveOld(arm: Arm, reads: Reads, region: Region, c: ColorBy) {
  const { features, strands } = reads
  const out: ModificationEntry[] = []
  const detected = new Set<string>()
  const seen = new Map()
  const fill = c.modifications?.fillUnmarked
  for (let i = 0; i < features.length; i++) {
    const f = features[i]!
    const s = strands[i]!
    const data = arm.extract(f, i, f.start, s, region, c, detected, seen, out)
    if (fill && data) {
      arm.methylation(i, f.start, s, region, data, out, c.modifications)
    }
  }
  return out
}

function driveBounded(arm: Arm, reads: Reads, region: Region, c: ColorBy) {
  const { features, strands } = reads
  const out: ModificationEntry[] = []
  const detected = new Set<string>()
  const seen = new Map()
  const fill = c.modifications?.fillUnmarked
  for (let i = 0; i < features.length; i++) {
    const f = features[i]!
    const s = strands[i]!
    const data = arm.extract(f, i, f.start, s, region, c, detected, seen, out)
    if (fill && data) {
      arm.methylation(i, f.start, s, region, data, out, c.modifications)
    }
  }
  return out
}

function driveControl(arm: Arm, reads: Reads, region: Region, c: ColorBy) {
  const { features, strands } = reads
  const out: ModificationEntry[] = []
  const detected = new Set<string>()
  const seen = new Map()
  const fill = c.modifications?.fillUnmarked
  for (let i = 0; i < features.length; i++) {
    const f = features[i]!
    const s = strands[i]!
    const data = arm.extract(f, i, f.start, s, region, c, detected, seen, out)
    if (fill && data) {
      arm.methylation(i, f.start, s, region, data, out, c.modifications)
    }
  }
  return out
}

function firstDifference(a: ModificationEntry[], b: ModificationEntry[]) {
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const x = JSON.stringify(a[i])
    const y = JSON.stringify(b[i])
    if (x !== y) {
      return `entry ${i} of ${a.length}/${b.length}: ${x} vs ${y}`
    }
  }
  return undefined
}

function expectSame(
  what: string,
  a: ModificationEntry[],
  b: ModificationEntry[],
) {
  const diff = firstDifference(a, b)
  if (diff !== undefined) {
    throw new Error(`${ONLY}: ${what} differ at ${diff}`)
  }
}

const old = await loadOld(BASE)
const control = await loadOld(BASE)
const bounded: Arm = {
  extract: extractModifications,
  methylation: extractMethylation,
}

const region: Region =
  ONLY === 'contig'
    ? { ...ON_REF, ...CONTIG }
    : {
        ...ON_REF,
        start: CENTER - Math.floor(Number(ONLY) / 2),
        end: CENTER + Math.ceil(Number(ONLY) / 2),
      }

const bam = new BamFile({
  bamPath: join(BAM, '200x.longread.mod.bam'),
  recordClass: BamSlightlyLazyFeature,
})
await bam.getHeader()
const features = await bam.getRecordsForRange(REFNAME, region.start, region.end)
const reads: Reads = { features, strands: features.map(f => getStrand(f)) }
const mbp = features.reduce((a, f) => a + f.seq_length, 0) / 1e6

// Every arm runs the same calls here, in both modes, so none reaches the timed
// loop with call sites the others lack.
const inRegion = (m: ModificationEntry) =>
  m.position >= region.start && m.position < region.end
let marks = 0
for (const c of [marksColorBy, fillColorBy]) {
  const oldOut = driveOld(old, reads, region, c)
  const boundedOut = driveBounded(bounded, reads, region, c)
  expectSame(
    `${c === fillColorBy ? 'fill' : 'marks'}: bounded and old`,
    boundedOut,
    oldOut,
  )
  expectSame(
    `${c === fillColorBy ? 'fill' : 'marks'}: control and old`,
    driveControl(control, reads, region, c),
    oldOut,
  )
  expectSame(
    `${c === fillColorBy ? 'fill' : 'marks'}: bounded and whole-read cut to the region`,
    boundedOut,
    driveOld(old, reads, WHOLE, c).filter(inRegion),
  )
  driveBounded(bounded, reads, WHOLE, c)
  driveControl(control, reads, WHOLE, c)
  if (boundedOut.length === 0) {
    throw new Error(`${ONLY}: no marks, so nothing was compared`)
  }
  if (c === colorBy) {
    marks = boundedOut.length
  }
}

const best = { old: Infinity, bounded: Infinity, control: Infinity }
let sink = 0
for (let r = 0; r < ROUNDS; r++) {
  for (let k = 0; k < 3; k++) {
    const which = (r + k) % 3
    globalThis.gc?.()
    const t = performance.now()
    if (which === 0) {
      sink += driveOld(old, reads, region, colorBy).length
    } else if (which === 1) {
      sink += driveBounded(bounded, reads, region, colorBy).length
    } else {
      sink += driveControl(control, reads, region, colorBy).length
    }
    const dt = performance.now() - t
    const key = which === 0 ? 'old' : which === 1 ? 'bounded' : 'control'
    best[key] = Math.min(best[key], dt)
  }
}

for (const dir of checkouts) {
  rmSync(dir, { recursive: true, force: true })
}

console.log(
  [
    ONLY.padStart(6),
    String(features.length).padStart(6),
    mbp.toFixed(1).padStart(7),
    String(marks).padStart(8),
    best.old.toFixed(1).padStart(8),
    best.bounded.toFixed(1).padStart(8),
    best.control.toFixed(1).padStart(8),
    `${(best.old / best.bounded).toFixed(2)}x`.padStart(12),
    (best.control / best.old).toFixed(2).padStart(12),
  ].join(' '),
  sink === 0 ? '(empty)' : '',
)
