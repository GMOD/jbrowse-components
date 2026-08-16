// The synthetic MAF-tabix BED that reference/MAF_WORKER_PIPELINE.md describes
// under "Reproducing it", built here rather than left as prose so a bench can
// depend on it: 1600 blocks x 26 species x 250 columns, ~4% dashes in the
// reference, divergence graded 2-20% across the species.
//
//   node plugins/maf/benches/mafTabixFixture.ts [--dir=<path>] [--force]
//
// The output is ~11MB of text and ~2.5MB bgzipped, which is why it lives in a
// temp directory instead of the repo. `bgzip` and `tabix` have to be on PATH.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface MafFixtureSpec {
  blocks: number
  species: number
  columns: number
  /** fraction of reference columns that are `-`, i.e. insertions in other rows */
  refGapRate: number
  /** genomic distance between one block's start and the next */
  spacing: number
  seed: number
}

export const DEFAULT_SPEC: MafFixtureSpec = {
  blocks: 1600,
  species: 26,
  columns: 250,
  refGapRate: 0.04,
  spacing: 1000,
  seed: 1,
}

/** Deterministic PRNG, so two runs of the bench measure the same bytes. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASES = 'ACGT'

/**
 * Divergence graded across the species rather than uniform: the profile this
 * fixture reproduces depends on the mismatch count, and MAF_WORKER_PIPELINE.md
 * records that a uniform rate gets it wrong in both directions.
 */
function divergenceFor(species: number, count: number) {
  return count < 2 ? 0.02 : 0.02 + (0.18 * (species - 1)) / (count - 2)
}

export function generateMafBed(spec: MafFixtureSpec = DEFAULT_SPEC) {
  const rand = mulberry32(spec.seed)
  const lines: string[] = []
  const starts = new Array<number>(spec.species).fill(0)

  for (let b = 0; b < spec.blocks; b++) {
    const ref: string[] = []
    for (let c = 0; c < spec.columns; c++) {
      ref.push(rand() < spec.refGapRate ? '-' : BASES[(rand() * 4) | 0]!)
    }
    const refLen = ref.reduce((n, ch) => n + (ch === '-' ? 0 : 1), 0)
    const blockStart = b * spec.spacing

    const entries: string[] = []
    for (let s = 0; s < spec.species; s++) {
      const divergence = divergenceFor(s, spec.species)
      const row = new Array<string>(spec.columns)
      let size = 0
      for (let c = 0; c < spec.columns; c++) {
        const refBase = ref[c]!
        // a reference gap is an insertion, so the other rows carry a base there
        let ch: string
        if (s === 0) {
          ch = refBase
        } else if (refBase === '-' || rand() >= divergence) {
          ch = refBase === '-' ? BASES[(rand() * 4) | 0]! : refBase
        } else {
          let next = BASES[(rand() * 4) | 0]!
          while (next === refBase) {
            next = BASES[(rand() * 4) | 0]!
          }
          ch = next
        }
        row[c] = ch
        if (ch !== '-') {
          size++
        }
      }
      entries.push(
        `sp${s}.chr1:${starts[s]}:${size}:+:100000000:${row.join('')}`,
      )
      starts[s]! += size
    }

    lines.push(
      `chr1\t${blockStart}\t${blockStart + refLen}\tblock${b}\t1\t${entries.join(',')}`,
    )
  }
  return { text: `${lines.join('\n')}\n`, span: spec.blocks * spec.spacing }
}

export interface MafFixture {
  bedGzPath: string
  tbiPath: string
  refName: string
  start: number
  end: number
}

export function ensureMafTabixFixture(
  dir = join(tmpdir(), 'maf-tabix-bench'),
  spec: MafFixtureSpec = DEFAULT_SPEC,
  force = false,
): MafFixture {
  mkdirSync(dir, { recursive: true })
  const name = `maf-${spec.blocks}x${spec.species}x${spec.columns}-sp${spec.spacing}-s${spec.seed}`
  const bedPath = join(dir, `${name}.bed`)
  const bedGzPath = join(dir, `${name}.bed.gz`)
  const tbiPath = `${bedGzPath}.tbi`
  const span = spec.blocks * spec.spacing

  if (force || !existsSync(tbiPath)) {
    const { text } = generateMafBed(spec)
    writeFileSync(bedPath, text)
    execFileSync('bgzip', ['-f', bedPath])
    execFileSync('tabix', ['-f', '-p', 'bed', bedGzPath])
  }
  return { bedGzPath, tbiPath, refName: 'chr1', start: 0, end: span }
}

if (process.argv[1]?.endsWith('mafTabixFixture.ts')) {
  const dirArg = process.argv.find(a => a.startsWith('--dir='))?.slice(6)
  const fixture = ensureMafTabixFixture(
    dirArg,
    DEFAULT_SPEC,
    process.argv.includes('--force'),
  )
  console.log(fixture)
}
