// Phase 5 CI concordance test. Drives the audit harness end-to-end:
//   adapter getSubgraph  →  canonicalize  →  structuralFingerprint
//   vg find              →  canonicalize  →  structuralFingerprint
// asserts the two fingerprints match. Locks in the publication-grade
// correctness gate from agent-docs/GRAPH_AUDIT.md.
//
// Skips when `vg` is not on PATH (covers contributor laptops without
// vg installed). CI must provision vg ≥ 1.59.0 so this never skips.

import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import {
  canonicalize,
  structuralFingerprint,
} from '../../../../tools/graph-truth-extractor/canonicalize.ts'

const repoRoot = path.resolve(__dirname, '../../../..')
const dumperScript = path.join(
  repoRoot,
  'plugins/comparative-adapters/scripts/dump-subgraph.ts',
)
const truthExtractorCli = path.join(
  repoRoot,
  'tools/graph-truth-extractor/cli.ts',
)

const fixturePrefix = path.join(
  repoRoot,
  'test_data/volvox/volvox_pangenome_50',
)
const fixtureGfa = `${fixturePrefix}.gfa`

function tryRun(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  return r.status === 0
}

const haveFixture =
  fs.existsSync(`${fixturePrefix}.pos.bed.gz`) &&
  fs.existsSync(fixtureGfa) &&
  fs.existsSync(dumperScript) &&
  fs.existsSync(truthExtractorCli)

const haveVg = tryRun('vg', ['version'])

const describeIfReady = haveFixture && haveVg ? describe : describe.skip

function dumpOurs(refPath: string, start: number, end: number) {
  return execFileSync(
    'node',
    [
      '--experimental-strip-types',
      dumperScript,
      fixturePrefix,
      refPath,
      String(start),
      String(end),
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
}

function dumpTruth(refPath: string, start: number, end: number) {
  return execFileSync(
    'node',
    [
      '--experimental-strip-types',
      truthExtractorCli,
      '--backend',
      'vg',
      '--gfa',
      fixtureGfa,
      '--path',
      refPath,
      '--start',
      String(start),
      '--end',
      String(end),
      '--context',
      '1',
      '--use-sequence',
      '--emit',
      'canonical',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
}

function fingerprint(gfa: string) {
  const canon = canonicalize(gfa, { useSequence: true })
  return structuralFingerprint(canon, { useSequence: true })
}

describeIfReady('Phase 5 CI: audit-harness concordance vs vg find', () => {
  // Each entry is `[path, start, end]`. Three regions exercise different
  // structural patterns: simple bubbles, an indel-rich span, and a tandem-
  // repeat region (the F6 pre-fix divergent case).
  const regions: [string, number, number][] = [
    ['ref#0#ctgA', 0, 500],
    ['ref#0#ctgA', 1000, 2000],
    ['ref#0#ctgA', 5000, 6000],
  ]

  for (const [refPath, start, end] of regions) {
    it(`${refPath}:${start}-${end} structural fingerprint matches vg find`, () => {
      const ours = dumpOurs(refPath, start, end)
      const truth = dumpTruth(refPath, start, end)
      const oursFp = fingerprint(ours)
      const truthFp = fingerprint(truth)
      expect(oursFp.combined).toBe(truthFp.combined)
    }, 30_000)
  }
})

const haveFixtureForSymmetry =
  haveFixture && fs.existsSync(`${fixturePrefix}.segments.seq.fa`)
const equivalentRangesScript = path.join(
  repoRoot,
  'plugins/comparative-adapters/scripts/equivalent-ranges.ts',
)
const describeIfSymmetry =
  haveFixtureForSymmetry && fs.existsSync(equivalentRangesScript)
    ? describe
    : describe.skip

describeIfSymmetry('Phase 5 CI: C3 path-symmetry across paths', () => {
  it('all paths sharing a viewport produce the same structural fingerprint', () => {
    const refPath = 'ref#0#ctgA'
    const start = 0
    const end = 500
    const tsv = execFileSync(
      'node',
      [
        '--experimental-strip-types',
        equivalentRangesScript,
        fixturePrefix,
        refPath,
        String(start),
        String(end),
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    )
    const rows = tsv
      .trim()
      .split('\n')
      .filter(l => l.length > 0)
      .map(l => {
        const [name, s, e] = l.split('\t')
        return { name: name!, start: +s!, end: +e! }
      })

    expect(rows.length).toBeGreaterThanOrEqual(3)

    const fps = rows.map(r => fingerprint(dumpOurs(r.name, r.start, r.end)))
    const first = fps[0]!.combined
    for (const fp of fps) {
      expect(fp.combined).toBe(first)
    }
  }, 60_000)
})
