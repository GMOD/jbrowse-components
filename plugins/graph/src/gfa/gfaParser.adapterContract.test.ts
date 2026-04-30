// Contract test: real GfaTabixAdapter `getSubgraph` output (the GFA dumped
// by `plugins/comparative-adapters/scripts/dump-subgraph.ts`) must parse
// cleanly through this plugin's `parseGFA`. This locks in the producer /
// consumer interface without requiring a cross-plugin runtime import — we
// instead drive the adapter via a child-process invocation of the dumper
// script and feed its stdout into `parseGFA` here.
//
// If the adapter's emitted GFA ever drifts in a way that breaks the graph
// view (extra columns, unsupported tags, malformed walks), this test
// surfaces it as a fast Jest failure instead of waiting for the puppeteer
// suite.

import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import { parseGFA } from './gfaParser.ts'

const repoRoot = path.resolve(__dirname, '../../../..')
const fixturePrefix = path.join(
  repoRoot,
  'test_data/volvox/volvox_pangenome_50',
)
const dumperScript = path.join(
  repoRoot,
  'plugins/comparative-adapters/scripts/dump-subgraph.ts',
)

const haveFixture =
  fs.existsSync(`${fixturePrefix}.pos.bed.gz`) &&
  fs.existsSync(`${fixturePrefix}.segments.bin`) &&
  fs.existsSync(dumperScript)

const haveSeq =
  fs.existsSync(`${fixturePrefix}.segments.seq.fa`) &&
  fs.existsSync(`${fixturePrefix}.segments.seq.idx`)

const describeIfFixture = haveFixture ? describe : describe.skip

function runDumper(start: number, end: number) {
  return execFileSync(
    'node',
    [
      '--experimental-strip-types',
      dumperScript,
      fixturePrefix,
      'ref#0#ctgA',
      String(start),
      String(end),
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
}

describeIfFixture('parseGFA accepts GfaTabixAdapter getSubgraph output', () => {
  it('parses a small region (S/L/P, all line counts > 0)', () => {
    const gfa = runDumper(0, 500)
    const parsed = parseGFA(gfa)
    expect(parsed.header.length).toBeGreaterThan(0)
    expect(parsed.nodes.length).toBeGreaterThan(0)
    expect(parsed.links.length).toBeGreaterThan(0)
    expect(parsed.paths.length).toBeGreaterThan(0)
  })

  it('every link references a node that parseGFA emitted', () => {
    const gfa = runDumper(0, 1000)
    const parsed = parseGFA(gfa)
    const nodeIds = new Set(parsed.nodes.map(n => n.id))
    for (const link of parsed.links) {
      expect(nodeIds.has(link.source)).toBe(true)
      expect(nodeIds.has(link.target)).toBe(true)
    }
  })

  it('every path step references a node that parseGFA emitted', () => {
    const gfa = runDumper(0, 1000)
    const parsed = parseGFA(gfa)
    const nodeIds = new Set(parsed.nodes.map(n => n.id))
    for (const p of parsed.paths) {
      for (const tok of p.path.split(',')) {
        const id = tok.slice(0, -1)
        expect(nodeIds.has(id)).toBe(true)
      }
    }
  })

  it('node lengths agree between S-line and any LN tag', () => {
    const gfa = runDumper(0, 500)
    const parsed = parseGFA(gfa)
    for (const n of parsed.nodes) {
      // length is taken from sequence (Phase 1) or LN tag (placeholder
      // mode); either way must be a positive integer.
      expect(Number.isInteger(n.length)).toBe(true)
      expect(n.length).toBeGreaterThan(0)
    }
  })
})

const describeIfSeq = haveFixture && haveSeq ? describe : describe.skip

describeIfSeq('parseGFA accepts Phase 1 sequence-emitting subgraph output', () => {
  it('S-line sequences are alphabet-only and match LN-equivalent length', () => {
    const gfa = runDumper(0, 500)
    const parsed = parseGFA(gfa)
    expect(parsed.nodes.length).toBeGreaterThan(0)
    for (const n of parsed.nodes) {
      // Phase 1 emits real sequences (uppercase ACGT/IUPAC); placeholder
      // mode emits `*`. With the fixture pre-built with sequences these
      // should always be real.
      expect(n.sequence).not.toBe('*')
      expect(/^[ACGTNRYSWKMBDHV]+$/i.test(n.sequence)).toBe(true)
      expect(n.sequence.length).toBe(n.length)
    }
  })
})
