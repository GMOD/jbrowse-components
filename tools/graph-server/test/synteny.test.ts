// Unit tests for the synteny block computation. Pure logic — no server, no
// odgi. Verifies that walking shared-node positions between paths emits
// sensible SyntenyBlock records.
//
// Run with: pnpm exec node --test --experimental-strip-types
//   tools/graph-server/test/synteny.test.ts

/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { computeSyntenyBlocks, parseExtractedGfa } from '../src/synteny.ts'

const SIMPLE_GFA = `H	VN:Z:1.1
S	1	ACGT
S	2	GG
S	3	AAAA
S	4	TTTT
P	ref#0#chr1:0-12	1+,2+,3+	*
P	alt#0#chr1:0-14	1+,2+,4+	*
`

test('parseExtractedGfa parses S and P lines and tracks coordinates', () => {
  const { segLens, paths } = parseExtractedGfa(SIMPLE_GFA)
  assert.equal(segLens.get(1), 4)
  assert.equal(segLens.get(2), 2)
  assert.equal(segLens.get(3), 4)
  assert.equal(segLens.get(4), 4)
  assert.equal(paths.length, 2)
  const ref = paths.find(p => p.refName === 'chr1' && p.genome === 'ref#0')
  assert.ok(ref)
  assert.equal(ref.baseOffset, 0)
  assert.deepEqual(
    ref.segs.map(s => ({ ord: s.ord, start: s.startInPath, end: s.endInPath })),
    [
      { ord: 1, start: 0, end: 4 },
      { ord: 2, start: 4, end: 6 },
      { ord: 3, start: 6, end: 10 },
    ],
  )
})

test('computeSyntenyBlocks emits one merged block where ref+alt share nodes', () => {
  const { paths } = parseExtractedGfa(SIMPLE_GFA)
  const blocks = computeSyntenyBlocks({
    refName: 'chr1',
    refGenome: 'ref#0',
    paths,
  })
  // Both paths share nodes 1 and 2 contiguously → one merged block on the
  // shared prefix; node 4 is alt-only so no block emitted for it.
  assert.equal(blocks.length, 1)
  const b = blocks[0]!
  assert.equal(b.queryGenome, 'alt#0')
  assert.equal(b.start, 0)
  assert.equal(b.end, 6)
  assert.equal(b.mateStart, 0)
  assert.equal(b.mateEnd, 6)
  assert.equal(b.strand, 1)
  assert.equal(b.mateRefName, 'chr1')
})

test('computeSyntenyBlocks respects path baseOffset (region-extracted GFA)', () => {
  // Simulate odgi extract over ref:1000-1012 — both paths start at offset 1000.
  const offsetGfa = `H	VN:Z:1.1
S	1	ACGT
S	2	GG
S	3	AAAA
P	ref#0#chr1:1000-1010	1+,2+,3+	*
P	alt#0#chr1:1000-1010	1+,2+,3+	*
`
  const { paths } = parseExtractedGfa(offsetGfa)
  const blocks = computeSyntenyBlocks({
    refName: 'chr1',
    refGenome: 'ref#0',
    paths,
  })
  assert.equal(blocks.length, 1)
  const b = blocks[0]!
  assert.equal(b.start, 1000)
  assert.equal(b.end, 1010)
  assert.equal(b.mateStart, 1000)
  assert.equal(b.mateEnd, 1010)
})

test('partial inversion (one node reversed) emits strand=-1 for that node', () => {
  // ref: 1+,2+,3+,4+  — nodes 1,3,4 large (4bp each), node 2 small (2bp)
  // alt: 1+,2-,3+,4+  — only node 2 is inverted (2bp out of 14bp shared → <99%)
  // node 2 block should be strand=-1; all others strand=+1.
  const flipGfa = `H	VN:Z:1.1
S	1	AAAA
S	2	GG
S	3	AAAA
S	4	AAAA
P	ref#0#chr1:0-14	1+,2+,3+,4+	*
P	alt#0#chr1:0-14	1+,2-,3+,4+	*
`
  const { paths } = parseExtractedGfa(flipGfa)
  const blocks = computeSyntenyBlocks({
    refName: 'chr1',
    refGenome: 'ref#0',
    paths,
  })
  const revBlocks = blocks.filter(b => b.strand === -1)
  assert.ok(revBlocks.length >= 1, 'expected at least one strand=-1 block')
  for (const b of revBlocks) {
    assert.equal(b.end - b.start, 2, 'only the 2bp node should be strand=-1')
  }
})

test('fully-reversed contig is normalized to strand=1', () => {
  // All shared segments have opposite orientation → >99% opposite → flip.
  // After flip the path is treated as forward, producing strand=1 blocks.
  const flipGfa = `H	VN:Z:1.1
S	1	AAAA
S	2	GG
P	ref#0#chr1:0-6	1+,2+	*
P	alt#0#chr1:0-6	2-,1-	*
`
  const { paths } = parseExtractedGfa(flipGfa)
  const blocks = computeSyntenyBlocks({
    refName: 'chr1',
    refGenome: 'ref#0',
    paths,
  })
  assert.ok(blocks.length >= 1)
  for (const b of blocks) {
    assert.equal(
      b.strand,
      1,
      'reversed contig should be normalized to strand=1',
    )
  }
})

test('computeSyntenyBlocks collapses runs with bubble cs for SNP alt', () => {
  // Ref path: 1+,2+,3+ (sequence AAAA GG AAAA) → ctgA:0..10
  // Alt path: 1+,4+,3+ (sequence AAAA GT AAAA, node 4 holds GT vs ref node 2's GG)
  // Expected: one collapsed feature spanning the full overlapping range with
  // cs threading the bubble. The bubble alt sequences are both "GG"/"GT" so
  // buildCs emits ":1*gt"; the surrounding colinear matches give ":4" prefix
  // and ":4" suffix → ":4:1*gt:4".
  const snpGfa = `H	VN:Z:1.1
S	1	AAAA
S	2	GG
S	3	AAAA
S	4	GT
P	ref#0#chr1:0-10	1+,2+,3+	*
P	alt#0#chr1:0-10	1+,4+,3+	*
`
  const { paths, segSeqs } = parseExtractedGfa(snpGfa)
  const blocks = computeSyntenyBlocks({
    refName: 'chr1',
    refGenome: 'ref#0',
    paths,
    segSeqs,
  })
  assert.equal(blocks.length, 1, 'expected one collapsed run feature')
  const run = blocks[0]!
  assert.equal(run.start, 0)
  assert.equal(run.end, 10)
  assert.equal(run.mateStart, 0)
  assert.equal(run.mateEnd, 10)
  assert.equal(run.cs, ':4:1*gt:4')
  assert.ok(run.identity < 1, 'run identity should reflect the SNP')
})

test('computeSyntenyBlocks chains an insertion bubble into the run cs', () => {
  // Ref alt segment is GG (2bp); query alt segment is GAAG (4bp insertion).
  // Common prefix "G" (1), common suffix "G" (1), middle is "" vs "AA".
  // Expected run cs: ":4:1+aa:1:4".
  const insGfa = `H	VN:Z:1.1
S	1	AAAA
S	2	GG
S	3	AAAA
S	4	GAAG
P	ref#0#chr1:0-10	1+,2+,3+	*
P	alt#0#chr1:0-12	1+,4+,3+	*
`
  const { paths, segSeqs } = parseExtractedGfa(insGfa)
  const blocks = computeSyntenyBlocks({
    refName: 'chr1',
    refGenome: 'ref#0',
    paths,
    segSeqs,
  })
  assert.equal(blocks.length, 1)
  const run = blocks[0]!
  assert.equal(run.cs, ':4:1+aa:1:4')
})

test('reversed contig with bubble chain: normalized to strand=1, cs still correct', () => {
  // Ref forward: AAAA GG TTTT at chr1:0-10.
  // Alt walks all shared nodes in opposite orient (100% opposite → reversed
  // contig normalization). After flipping, anchors are strand=1 and the
  // bubble alt sequence is "CT" (node 4 orient+); buildCs("GG","CT")="*gc*gt".
  const revGfa = `H	VN:Z:1.1
S	1	AAAA
S	2	GG
S	3	TTTT
S	4	CT
P	ref#0#chr1:0-10	1+,2+,3+	*
P	alt#0#chr1:0-10	3-,4-,1-	*
`
  const { paths, segSeqs } = parseExtractedGfa(revGfa)
  const blocks = computeSyntenyBlocks({
    refName: 'chr1',
    refGenome: 'ref#0',
    paths,
    segSeqs,
  })
  assert.equal(blocks.length, 1, 'expected one collapsed run')
  const run = blocks[0]!
  assert.equal(run.strand, 1)
  assert.equal(run.start, 0)
  assert.equal(run.end, 10)
  assert.equal(run.mateStart, 0)
  assert.equal(run.mateEnd, 10)
  assert.equal(run.cs, ':4*gc*gt:4')
})

test('reversed contig with indel bubble: normalized to strand=1, cs still correct', () => {
  // Same shape as the SNP reversed-contig case, but node 4 has a 4bp
  // insertion vs ref node 2 (GG). After normalization the path is strand=1;
  // node 4 is read orient+ as "AACCGG". buildCs("GG","AACCGG") → "+aacc:2".
  // Run cs: ":4+aacc:2:4".
  const revIns = `H	VN:Z:1.1
S	1	AAAA
S	2	GG
S	3	TTTT
S	4	AACCGG
P	ref#0#chr1:0-10	1+,2+,3+	*
P	alt#0#chr1:0-14	3-,4-,1-	*
`
  const { paths, segSeqs } = parseExtractedGfa(revIns)
  const blocks = computeSyntenyBlocks({
    refName: 'chr1',
    refGenome: 'ref#0',
    paths,
    segSeqs,
  })
  assert.equal(blocks.length, 1)
  const run = blocks[0]!
  assert.equal(run.strand, 1)
  assert.equal(run.cs, ':4+aacc:2:4')
})

test('parseExtractedGfa handles W-line walks', () => {
  // hapIdx="0" → two-part PanSN (matches vg paths -L); hapIdx="1" → three-part.
  const wGfa = `H	VN:Z:1.1
S	1	ACGT
S	2	GG
W	ref	0	chr1	0	6	>1>2
W	alt	0	chr1	100	106	>1<2
W	alt	1	chr1	200	206	>1>2
`
  const { paths } = parseExtractedGfa(wGfa)
  assert.equal(paths.length, 3)
  const altHap0 = paths.find(p => p.name === 'alt#chr1' && p.baseOffset === 100)
  assert.ok(altHap0)
  assert.equal(altHap0.genome, 'alt')
  assert.equal(altHap0.refName, 'chr1')
  assert.equal(altHap0.segs.length, 2)
  assert.equal(altHap0.segs[0]!.ord, 1)
  assert.equal(altHap0.segs[0]!.orient, 1)
  assert.equal(altHap0.segs[1]!.ord, 2)
  assert.equal(altHap0.segs[1]!.orient, -1)
  const altHap1 = paths.find(p => p.name === 'alt#1#chr1')
  assert.ok(altHap1)
  assert.equal(altHap1.genome, 'alt#1')
  assert.equal(altHap1.refName, 'chr1')
})
