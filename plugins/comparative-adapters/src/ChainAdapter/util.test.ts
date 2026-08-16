import { paf_chain2paf } from './util.ts'

const enc = (s: string) => new TextEncoder().encode(s)

// The example from the UCSC chain format spec, whose minus-strand query is the
// whole reason this parser is more than a line splitter.
const SPEC_EXAMPLE = `chain 4900 chrY 58368225 + 25985403 25985638 chr5 151006098 - 43257292 43257528 1
9\t1\t0
10\t0\t5
61\t4\t0
16\t0\t4
42\t3\t0
16\t0\t8
14\t1\t0
3\t7\t0
48

`

describe('paf_chain2paf', () => {
  test('reads the spec example, flipping the minus-strand query forward', () => {
    const [r] = paf_chain2paf(enc(SPEC_EXAMPLE))
    expect(r).toMatchObject({
      tname: 'chrY',
      tstart: 25985403,
      tend: 25985638,
      qname: 'chr5',
      // qSize - qEnd and qSize - qStart. Read straight off the file these would
      // be 43257292/43257528, on the reverse-complemented sequence.
      qstart: 151006098 - 43257528,
      qend: 151006098 - 43257292,
      strand: -1,
    })
    expect(r!.extra.cg).toBe('9M1D10M5I61M4D16M4I42M3D16M8I14M1D3M7D48M')
  })

  test('dt becomes D and dq becomes I', () => {
    // A target-side gap consumes reference only; a query-side gap consumes
    // query only. Swapping them still produces a plausible CIGAR, which is why
    // it needs stating rather than eyeballing.
    const [r] = paf_chain2paf(
      enc(`chain 100 t 1000 + 0 25 q 1000 + 0 22 1
10\t0\t0
10\t5\t2
`),
    )
    expect(r!.extra.cg).toBe('10M10M2I5D')
    expect(r!.tend - r!.tstart).toBe(20 + 5)
    expect(r!.qend - r!.qstart).toBe(20 + 2)
  })

  test('blockLen is M+I+D, not max(qspan, tspan)', () => {
    // 10M5I3D: the old max() denominator said 15 and inflated identity to 2/3
    // where the PAF definition gives 10/18.
    const [r] = paf_chain2paf(
      enc(`chain 100 t 1000 + 0 13 q 1000 + 0 15 1
10\t3\t5
`),
    )
    expect(r!.extra.cg).toBe('10M5I3D')
    expect(r!.extra.numMatches).toBe(10)
    expect(r!.extra.blockLen).toBe(18)
  })

  test('a block list that under-covers its own interval is padded, not dropped', () => {
    // A lossy PAF→chain conversion writes one block of the query length and
    // drops the target gap, so the CIGAR came out 5bp short of the interval the
    // same record reports. 215 of the 278 chains in the yeast demo track do
    // this, off by up to 20kb.
    const [r] = paf_chain2paf(
      enc(`chain 100 t 1000 + 100 205 q 1000 + 0 100 1
100
`),
    )
    expect(r!.extra.cg).toBe('100M5D')
    expect(r!.extra.blockLen).toBe(105)
  })

  test('multiple chains, CRLF line endings, and no trailing newline', () => {
    const body = `chain 100 t1 1000 + 0 20 q1 1000 + 0 20 1
10\t0\t0
10
chain 100 t2 1000 + 0 30 q2 1000 + 0 30 2
30`
    for (const text of [body, body.replaceAll('\n', '\r\n')]) {
      expect(paf_chain2paf(enc(text)).map(r => [r.tname, r.extra.cg])).toEqual([
        ['t1', '10M10M'],
        ['t2', '30M'],
      ])
    }
  })

  test('comment lines are skipped', () => {
    expect(
      paf_chain2paf(
        enc(`# written by axtChain
chain 100 t 1000 + 0 10 q 1000 + 0 10 1
10
`),
      ),
    ).toHaveLength(1)
  })

  test('data lines before the first header do not become a record', () => {
    // They belong to no chain, and flushing them emitted a phantom feature with
    // an empty refName and a zero-length span.
    expect(
      paf_chain2paf(
        enc(`5\t0\t0
chain 100 t 1000 + 0 10 q 1000 + 0 10 1
10
`),
      ).map(r => r.tname),
    ).toEqual(['t'])
  })

  test('a chain file carries no mapping quality', () => {
    // Emitting 0 read as MAPQ 0 ("multi-mapping") in the color ramp and
    // group-by rather than "unavailable".
    const [r] = paf_chain2paf(enc(SPEC_EXAMPLE))
    expect(r!.extra).not.toHaveProperty('mappingQual')
  })
})
