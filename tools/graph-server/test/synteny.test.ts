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

test('reverse-strand block flips strand to -1', () => {
  const flipGfa = `H	VN:Z:1.1
S	1	AAAA
S	2	GG
P	ref#0#chr1:0-6	1+,2+	*
P	alt#0#chr1:0-6	1-,2-	*
`
  const { paths } = parseExtractedGfa(flipGfa)
  const blocks = computeSyntenyBlocks({
    refName: 'chr1',
    refGenome: 'ref#0',
    paths,
  })
  assert.ok(blocks.length >= 1)
  for (const b of blocks) {
    assert.equal(b.strand, -1)
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

test('reverse-strand chain emits ref-forward cs with revcomped alt', () => {
  // Ref forward: AAAA GG TTTT at chr1:0-10.
  // Alt walks ref in reverse with a bubble: 3-, 4-, 1- — the alt anchors are
  // the same nodes (1 and 3) but traversed reverse, so the resulting blocks
  // are both strand=-1. Node 4 (CT) replaces node 2 (GG); when the alt
  // segment is revcomp'd to align with ref forward it becomes "AG" → "CT"
  // mapped to ref "GG" gives "*gc*gt".
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
  assert.equal(blocks.length, 1, 'expected one collapsed reverse-strand run')
  const run = blocks[0]!
  assert.equal(run.strand, -1)
  assert.equal(run.start, 0)
  assert.equal(run.end, 10)
  assert.equal(run.mateStart, 0)
  assert.equal(run.mateEnd, 10)
  assert.equal(run.cs, ':4*gc*gt:4')
})

test('reverse-strand chain encodes an indel bubble correctly', () => {
  // Same shape as the SNP reverse-strand case, but node 4 has a 4bp
  // insertion vs ref node 2 (GG). Forward alt seq at bp[4,10): node 4
  // traversed reverse = revcomp("AACCGG") = "CCGGTT". Revcomp'd back to
  // align with ref forward → "AACCGG". buildCs("GG", "AACCGG") consumes
  // the whole 2bp ref as a common suffix → "+aacc:2", and the run wraps
  // it in the 4bp colinear matches on either side: ":4+aacc:2:4".
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
  assert.equal(run.strand, -1)
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
