// Unit tests for the runtime coarsener prototype. Constructs synthetic
// edge-index bytes in memory (no fixture files) so the coverage exercises
// the algorithm — not the I/O — across the topology shapes the production
// Rust port has to match: linear ref-only, single small bubble (collapse),
// single large bubble (preserve with through-edges), bubble at end of
// viewport, and BFS cap-hit (forced-collapse).

import { buildGfaCoarsened } from './gfaCoarsener.ts'

import type { IndexedBinaryShard } from './gfaBinaryIO.ts'
import type { GenericFilehandle } from 'generic-filehandle2'

const EDGE_RECORD_SIZE = 10
const ORIENT_PLUS = 0x2b

interface SyntheticEdge {
  src: number
  tgt: number
  srcO?: number
  tgtO?: number
  tgtLen: number
}

// Build edges.bin + edges.idx in memory matching the on-disk layout the
// real preprocessor emits. Bidirected partner emission (`L a + b +` ⇔ the
// reverse-flipped pair) is included so the tests reflect the production
// edge-shard shape.
function buildEdgeShard(
  numSegments: number,
  edges: SyntheticEdge[],
): IndexedBinaryShard {
  const adj = new Map<number, SyntheticEdge[]>()
  for (const e of edges) {
    const sO = e.srcO ?? ORIENT_PLUS
    const tO = e.tgtO ?? ORIENT_PLUS
    const tgtLen = e.tgtLen
    if (!adj.has(e.src)) {
      adj.set(e.src, [])
    }
    adj.get(e.src)!.push({ src: e.src, tgt: e.tgt, srcO: sO, tgtO: tO, tgtLen })
    // Bidirected partner: `L src sO tgt tO` ↔ `L tgt ~tO src ~sO`.
    const flip = (o: number) => (o === 0x2b ? 0x2d : 0x2b)
    const srcLen = edges.find(x => x.src === e.src)?.tgtLen ?? 0
    if (!adj.has(e.tgt)) {
      adj.set(e.tgt, [])
    }
    adj.get(e.tgt)!.push({
      src: e.tgt,
      tgt: e.src,
      srcO: flip(tO),
      tgtO: flip(sO),
      tgtLen: srcLen,
    })
  }

  const idx = new BigUint64Array(numSegments + 1)
  let offset = 0
  for (let ord = 0; ord <= numSegments; ord++) {
    idx[ord] = BigInt(offset)
    if (ord < numSegments) {
      const adjList = adj.get(ord) ?? []
      offset += adjList.length * EDGE_RECORD_SIZE
    }
  }

  const bin = new Uint8Array(offset)
  const view = new DataView(bin.buffer)
  for (let ord = 0; ord < numSegments; ord++) {
    const start = Number(idx[ord]!)
    const adjList = adj.get(ord) ?? []
    for (let i = 0; i < adjList.length; i++) {
      const e = adjList[i]!
      const off = start + i * EDGE_RECORD_SIZE
      view.setUint32(off, e.tgt, true)
      view.setUint8(off + 4, e.srcO ?? ORIENT_PLUS)
      view.setUint8(off + 5, e.tgtO ?? ORIENT_PLUS)
      view.setUint32(off + 6, e.tgtLen, true)
    }
  }

  // .idx file holds the BigUint64Array bytes. The runtime reads it as a
  // BigUint64Array via loadBinaryIndex — so the bytes are exactly idx.buffer.
  const idxBytes = new Uint8Array(idx.buffer)

  const binFile = makeMemoryFile(bin)
  const idxFile = makeMemoryFile(idxBytes)
  return { filehandle: binFile, idxFile }
}

function makeMemoryFile(bytes: Uint8Array): GenericFilehandle {
  return {
    async read(length: number, position: number) {
      const out = new Uint8Array(length)
      out.set(bytes.subarray(position, position + length))
      return out
    },
    async readFile() {
      const out = new Uint8Array(bytes.length)
      out.set(bytes)
      return out
    },
    async stat() {
      return { size: bytes.length }
    },
    async close() {},
  } as GenericFilehandle
}

// Shorthand assertions on emitted GFA text.
function parseGfa(gfa: string) {
  const segs: string[] = []
  const links: string[] = []
  const walks: string[] = []
  for (const line of gfa.split('\n')) {
    if (line.startsWith('S\t')) {
      segs.push(line)
    } else if (line.startsWith('L\t')) {
      links.push(line)
    } else if (line.startsWith('W\t')) {
      walks.push(line)
    }
  }
  return { segs, links, walks }
}

describe('buildGfaCoarsened', () => {
  it('returns empty string for empty viewport', async () => {
    const shard = buildEdgeShard(1, [])
    const segLens = new Map<number, number>()
    const out = await buildGfaCoarsened(
      [],
      segLens,
      shard,
      ['ref#0#chr'],
      0,
      100,
    )
    expect(out).toBe('')
  })

  it('emits a single super-segment for a linear-only ref-only run', async () => {
    // 5 ref segments in a chain: 0→1→2→3→4. No alt edges.
    const segLens = new Map<number, number>()
    for (let i = 0; i < 5; i++) {
      segLens.set(i, 100)
    }
    const edges: SyntheticEdge[] = []
    for (let i = 0; i < 4; i++) {
      edges.push({ src: i, tgt: i + 1, tgtLen: 100 })
    }
    const shard = buildEdgeShard(5, edges)
    const out = await buildGfaCoarsened(
      [0, 1, 2, 3, 4],
      segLens,
      shard,
      ['ref#0#chr'],
      0,
      100,
    )
    const { segs, links, walks } = parseGfa(out)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatch(/^S\tsuper_0\t\*\tLN:i:500\tSC:i:5/)
    expect(links).toHaveLength(0)
    expect(walks).toHaveLength(1)
    expect(walks[0]).toMatch(/>super_0$/)
    expect(walks[0]).toMatch(/\t0\t500\t/)
  })

  it('collapses a small bubble (alt-walk below threshold)', async () => {
    // ref: 0 → 1 → 2 → 3
    // alt: 0 → 4 → 2  (alt-walk seg 4 len 1 — below threshold 100)
    const segLens = new Map<number, number>()
    for (let i = 0; i < 4; i++) {
      segLens.set(i, 100)
    }
    segLens.set(4, 1)
    const edges: SyntheticEdge[] = [
      { src: 0, tgt: 1, tgtLen: 100 },
      { src: 1, tgt: 2, tgtLen: 100 },
      { src: 2, tgt: 3, tgtLen: 100 },
      { src: 0, tgt: 4, tgtLen: 1 },
      { src: 4, tgt: 2, tgtLen: 100 },
    ]
    const shard = buildEdgeShard(5, edges)
    const out = await buildGfaCoarsened(
      [0, 1, 2, 3],
      segLens,
      shard,
      ['ref#0#chr'],
      0,
      100,
    )
    const { segs, links, walks } = parseGfa(out)
    // Single super-segment — the small bubble collapsed; alt seg 4 dropped.
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatch(/^S\tsuper_0/)
    expect(segs[0]).not.toContain('s4')
    // No alt segs in the segment list.
    expect(segs.find(s => s.startsWith('S\ts4'))).toBeUndefined()
    expect(walks[0]).toMatch(/>super_0$/)
    expect(links).toHaveLength(0)
  })

  it('preserves a large bubble (alt-walk above threshold)', async () => {
    // ref: 0 → 1 → 2 → 3
    // alt: 1 → 4 → 2  (alt seg 4 len 500 — above threshold 100)
    const segLens = new Map<number, number>()
    for (let i = 0; i < 4; i++) {
      segLens.set(i, 100)
    }
    segLens.set(4, 500)
    const edges: SyntheticEdge[] = [
      { src: 0, tgt: 1, tgtLen: 100 },
      { src: 1, tgt: 2, tgtLen: 100 },
      { src: 2, tgt: 3, tgtLen: 100 },
      { src: 1, tgt: 4, tgtLen: 500 },
      { src: 4, tgt: 2, tgtLen: 100 },
    ]
    const shard = buildEdgeShard(5, edges)
    const out = await buildGfaCoarsened(
      [0, 1, 2, 3],
      segLens,
      shard,
      ['ref#0#chr'],
      0,
      100,
    )
    const { segs, links, walks } = parseGfa(out)
    // Two super-segments — bubble between them — plus alt seg 4.
    const superSegs = segs.filter(s => s.includes('super_'))
    expect(superSegs).toHaveLength(2)
    const altSegs = segs.filter(s => /^S\ts\d/.exec(s))
    expect(altSegs.length).toBeGreaterThanOrEqual(1)
    expect(segs.find(s => s.startsWith('S\ts4'))).toBeDefined()
    // Walk traverses both super-segments through ref-allele.
    expect(walks[0]).toMatch(/>super_0/)
    expect(walks[0]).toMatch(/>super_1/)
    // L lines connect super_0/1 to alt seg 4 and via ref-allele.
    expect(links.length).toBeGreaterThan(0)
  })

  it('handles bubble with cap-hit topology by collapsing', async () => {
    // 3 ref segments. From ref_0 a deep alt-chain extends 20 hops without
    // reconverging — exceeds MAX_BFS_DEPTH=8 → capHit → collapse.
    const segLens = new Map<number, number>([[0, 100], [1, 100], [2, 100]])
    const edges: SyntheticEdge[] = [
      { src: 0, tgt: 1, tgtLen: 100 },
      { src: 1, tgt: 2, tgtLen: 100 },
    ]
    // Long alt-chain from ref_0: 100 → 101 → 102 → ... 119
    for (let i = 0; i < 20; i++) {
      const cur = 100 + i
      segLens.set(cur, 50)
      edges.push({ src: i === 0 ? 0 : cur - 1, tgt: cur, tgtLen: 50 })
    }
    const shard = buildEdgeShard(120, edges)
    const out = await buildGfaCoarsened(
      [0, 1, 2],
      segLens,
      shard,
      ['ref#0#chr'],
      0,
      10,
    )
    const { segs, walks } = parseGfa(out)
    // Cap-hit forces collapse → single super-segment, no alt segs emitted,
    // no orphan L-lines that would render as dangling tips.
    const altSegLines = segs.filter(s => /^S\ts1\d\d/.test(s))
    expect(altSegLines).toHaveLength(0)
    expect(walks).toHaveLength(1)
  })

  it('emits valid W-line PanSN parsing for `sample#hap#contig` paths', async () => {
    const segLens = new Map<number, number>([[0, 100], [1, 100]])
    const edges: SyntheticEdge[] = [{ src: 0, tgt: 1, tgtLen: 100 }]
    const shard = buildEdgeShard(2, edges)
    const out = await buildGfaCoarsened(
      [0, 1],
      segLens,
      shard,
      ['HG002#1#chr20'],
      0,
      100,
    )
    const { walks } = parseGfa(out)
    expect(walks[0]).toMatch(/^W\tHG002\t1\tchr20\t/)
  })

  it('falls back to (name, 0, name) for non-PanSN path names', async () => {
    const segLens = new Map<number, number>([[0, 100], [1, 100]])
    const edges: SyntheticEdge[] = [{ src: 0, tgt: 1, tgtLen: 100 }]
    const shard = buildEdgeShard(2, edges)
    const out = await buildGfaCoarsened(
      [0, 1],
      segLens,
      shard,
      ['ctgA'],
      0,
      100,
    )
    const { walks } = parseGfa(out)
    expect(walks[0]).toMatch(/^W\tctgA\t0\tctgA\t/)
  })

  // Data-fidelity invariant: the W-line span in coarsened output equals the
  // sum of viewport ref-segment lengths, regardless of how bubbles split or
  // collapse. Catches regressions where a bubble boundary drops or doubles a
  // ref segment's bp contribution. This is the strongest cheap check that the
  // coarsener is faithful to the input GFA's ref-path coordinate space.
  it('preserves total ref-path bp across collapse and preserve cases', async () => {
    // Mixed topology: ref [0..5], small bubble at 1→3 (collapses, alt seg 10
    // dropped), large bubble at 3→5 (preserves, alt seg 11 emitted). Total
    // ref bp = 6 segs × 100 = 600.
    const segLens = new Map<number, number>()
    for (let i = 0; i < 6; i++) {
      segLens.set(i, 100)
    }
    segLens.set(10, 1)
    segLens.set(11, 500)
    const edges: SyntheticEdge[] = [
      { src: 0, tgt: 1, tgtLen: 100 },
      { src: 1, tgt: 2, tgtLen: 100 },
      { src: 2, tgt: 3, tgtLen: 100 },
      { src: 3, tgt: 4, tgtLen: 100 },
      { src: 4, tgt: 5, tgtLen: 100 },
      { src: 1, tgt: 10, tgtLen: 1 },
      { src: 10, tgt: 3, tgtLen: 100 },
      { src: 3, tgt: 11, tgtLen: 500 },
      { src: 11, tgt: 5, tgtLen: 100 },
    ]
    const shard = buildEdgeShard(12, edges)
    const out = await buildGfaCoarsened(
      [0, 1, 2, 3, 4, 5],
      segLens,
      shard,
      ['ref#0#chr'],
      0,
      100,
    )
    const { walks } = parseGfa(out)
    const cols = walks[0]!.split('\t')
    const start = +cols[4]!
    const end = +cols[5]!
    expect(end - start).toBe(600)
  })

  // Edge fidelity: the coarsener never emits an L-line whose endpoint isn't
  // also emitted as an S-line. Catches the failure mode where bubble BFS
  // discovers an alt segment but the emit pass forgets to declare it.
  it('every L-line endpoint also appears as an S-line', async () => {
    const segLens = new Map<number, number>()
    for (let i = 0; i < 5; i++) {
      segLens.set(i, 100)
    }
    segLens.set(10, 500)
    const edges: SyntheticEdge[] = [
      { src: 0, tgt: 1, tgtLen: 100 },
      { src: 1, tgt: 2, tgtLen: 100 },
      { src: 2, tgt: 3, tgtLen: 100 },
      { src: 3, tgt: 4, tgtLen: 100 },
      { src: 1, tgt: 10, tgtLen: 500 },
      { src: 10, tgt: 3, tgtLen: 100 },
    ]
    const shard = buildEdgeShard(11, edges)
    const out = await buildGfaCoarsened(
      [0, 1, 2, 3, 4],
      segLens,
      shard,
      ['ref#0#chr'],
      0,
      100,
    )
    const { segs, links } = parseGfa(out)
    const segIds = new Set(segs.map(s => s.split('\t')[1]!))
    for (const link of links) {
      const cols = link.split('\t')
      expect(segIds.has(cols[1]!)).toBe(true)
      expect(segIds.has(cols[3]!)).toBe(true)
    }
    expect(links.length).toBeGreaterThan(0)
  })

  it('always emits a connected graph (no orphan alt segments)', async () => {
    // Mix of small + large bubbles; verify every alt seg has at least one
    // L-line connecting it to a super-segment or another alt seg.
    const segLens = new Map<number, number>()
    for (let i = 0; i < 6; i++) {
      segLens.set(i, 100)
    }
    segLens.set(10, 500) // large alt
    segLens.set(11, 1)   // small alt (collapses)
    const edges: SyntheticEdge[] = [
      { src: 0, tgt: 1, tgtLen: 100 },
      { src: 1, tgt: 2, tgtLen: 100 },
      { src: 2, tgt: 3, tgtLen: 100 },
      { src: 3, tgt: 4, tgtLen: 100 },
      { src: 4, tgt: 5, tgtLen: 100 },
      // Large bubble between 1 and 3
      { src: 1, tgt: 10, tgtLen: 500 },
      { src: 10, tgt: 3, tgtLen: 100 },
      // Small bubble between 4 and 5
      { src: 4, tgt: 11, tgtLen: 1 },
      { src: 11, tgt: 5, tgtLen: 100 },
    ]
    const shard = buildEdgeShard(12, edges)
    const out = await buildGfaCoarsened(
      [0, 1, 2, 3, 4, 5],
      segLens,
      shard,
      ['ref#0#chr'],
      0,
      100,
    )
    const { segs, links } = parseGfa(out)
    // For every alt seg in segs, at least one L-line touches it.
    const altSegIds = segs
      .filter(s => /^S\ts\d/.test(s))
      .map(s => s.split('\t')[1]!)
    for (const id of altSegIds) {
      const touched = links.some(l => l.includes(`\t${id}\t`))
      expect(touched).toBe(true)
    }
  })
})
