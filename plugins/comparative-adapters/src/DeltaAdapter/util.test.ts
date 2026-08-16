import { readFileSync } from 'node:fs'

import { getLength, getLengthOnRef, parseCigar2 } from '@jbrowse/cigar-utils'

import { paf_delta2paf } from './util.ts'

const enc = (s: string) => new TextEncoder().encode(s)
const HEAD = '/data/ref.fa /data/qry.fa\nNUCMER\n\n'

/** Alignment columns, M+I+D — the length PAF's blockLen column counts. */
const alignmentColumns = (cigar: string) =>
  parseCigar2(cigar).reduce((a, op) => a + (op >> 4), 0)

// Three sections of real nucmer output from the R64-vs-YJM1447 alignment the
// yeast_synteny demo serves.
const REAL = require.resolve('../test_data/yeast.delta')

describe('paf_delta2paf', () => {
  test('converts 1-based inclusive coordinates to half-open', () => {
    const [r] = paf_delta2paf(
      enc(`${HEAD}>refA qryA 1000 1000
1 100 1 100 0 0 0
0
`),
    )
    expect(r).toMatchObject({
      tname: 'refA',
      tstart: 0,
      tend: 100,
      qname: 'qryA',
      qstart: 0,
      qend: 100,
      strand: 1,
    })
    expect(r!.extra.cg).toBe('100M')
  })

  test('a positive offset is a reference insertion (D), a negative one a query insertion (I)', () => {
    const [r] = paf_delta2paf(
      enc(`${HEAD}>refA qryB 1000 1000
200 299 300 399 2 2 0
20
-30
0
`),
    )
    expect(r!.extra.cg).toBe('19M1D29M1I51M')
    expect(r!.extra.blockLen).toBe(101)
    expect(r!.extra.numMatches).toBe(99)
  })

  test('a reversed query is reported forward with strand -1', () => {
    const [r] = paf_delta2paf(
      enc(`${HEAD}>refA qryA 1000 1000
1 100 200 101 0 0 0
0
`),
    )
    expect(r).toMatchObject({ qstart: 100, qend: 200, strand: -1 })
  })

  test('a single-base alignment is forward, not reverse', () => {
    // `t0 < t1 && t2 < t3` and `t0 > t1 && t2 > t3` are both false when the
    // alignment is one base long, and the fallthrough called it reverse.
    const [r] = paf_delta2paf(
      enc(`${HEAD}>refA qryA 1000 1000
50 50 60 60 0 0 0
0
`),
    )
    expect(r).toMatchObject({ tstart: 49, tend: 50, strand: 1 })
  })

  test('one unreconcilable record costs only itself', () => {
    // This used to throw out of paf_delta2paf, so a single bad record emptied
    // the whole track — and said `inconsistent alignment on line 0`, naming the
    // terminator rather than the record.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const records = paf_delta2paf(
      enc(`${HEAD}>refA qryA 1000 1000
1 100 1 100 0 0 0
0
>refA qryBAD 1000 1000
200 299 300 399 0 0 0
20
0
>refA qryC 1000 1000
500 599 500 599 0 0 0
0
`),
    )
    expect(records.map(r => r.qname)).toEqual(['qryA', 'qryC'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipped 1'))
    warn.mockRestore()
  })

  test('a final record with no terminating 0 is still emitted', () => {
    // Records are only pushed at their `0`, so a truncated file silently lost
    // its last alignment.
    expect(
      paf_delta2paf(
        enc(`${HEAD}>refA qryA 1000 1000
1 100 1 100 0 0 0
0
>refA qryB 1000 1000
200 299 300 399 0 0 0
`),
      ).map(r => r.qname),
    ).toEqual(['qryA', 'qryB'])
  })

  test('a line that is neither a header nor an offset is skipped', () => {
    // It used to fall through to the offset branch as a NaN, ride into the
    // CIGAR, and surface much later as the record failing to reconcile.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      paf_delta2paf(
        enc(`${HEAD}>refA qryA 1000 1000
1 100 1 100 0 0 0
some trailing junk
0
`),
      ),
    ).toHaveLength(1)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('real nucmer output parses with every CIGAR spanning its own interval', () => {
    const records = paf_delta2paf(new Uint8Array(readFileSync(REAL)))
    expect(records.length).toBeGreaterThan(50)
    expect(records.some(r => r.strand === -1)).toBe(true)
    for (const r of records) {
      const cg = r.extra.cg!
      expect(getLengthOnRef(cg)).toBe(r.tend - r.tstart)
      expect(getLength(cg)).toBe(r.qend - r.qstart)
      expect(r.extra.blockLen).toBe(alignmentColumns(cg))
    }
  })

  test('a delta file carries no mapping quality', () => {
    const [r] = paf_delta2paf(
      enc(`${HEAD}>refA qryA 1000 1000
1 100 1 100 0 0 0
0
`),
    )
    expect(r!.extra).not.toHaveProperty('mappingQual')
  })
})
