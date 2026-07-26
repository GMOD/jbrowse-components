import { revcom } from '@jbrowse/core/util'

import { parseIsPcrProducts } from './ispcrQuery.ts'
import { ispcrToSam } from './ispcrToSam.ts'

const FWD = 'GTGACGTCGTGACCTAGGAAAA'
const REV = 'CCTAGGTTGACGTCACGATTTT'

// one plus-strand and one minus-strand product of the same primer pair
const response = (sign: '+' | '-') => `<HTML><BODY><PRE>
><A HREF="../cgi-bin/hgTracks?db=hg38">chr17:7676521${sign}7676667</A> 147bp ${FWD} ${REV}
AGTTTCCATAGGTCTGAAAATG
</PRE></BODY></HTML>`

const records = (sign: '+' | '-') =>
  ispcrToSam(parseIsPcrProducts(response(sign)))
    .split('\n')
    .filter(line => line && !line.startsWith('@'))
    .map(line => {
      const f = line.split('\t')
      return {
        qName: f[0]!,
        flag: Number(f[1]),
        refName: f[2]!,
        pos: Number(f[3]),
        cigar: f[5]!,
        matePos: Number(f[7]),
        tlen: Number(f[8]),
        seq: f[9]!,
      }
    })

test('a product becomes one pair, mates naming each other', () => {
  const [low, high] = records('+')
  expect(low!.qName).toBe(high!.qName)
  expect(low!.refName).toBe('chr17')
  expect(low!.pos).toBe(7676521)
  expect(high!.pos).toBe(7676667 - REV.length + 1)
  // each mate points at the other, which is what pairs them on one row
  expect(low!.matePos).toBe(high!.pos)
  expect(high!.matePos).toBe(low!.pos)
})

// two products of one primer pair must not share a QNAME, or they read as a
// single pair spanning both of them
test('each product gets its own pair name', () => {
  const two = `<HTML><BODY><PRE>
>chr17:7676521+7676667 147bp ${FWD} ${REV}
>chr6:100+400 301bp ${FWD} ${REV}
</PRE></BODY></HTML>`
  const names = ispcrToSam(parseIsPcrProducts(two))
    .split('\n')
    .filter(line => line && !line.startsWith('@'))
    .map(line => line.split('\t')[0])
  expect(new Set(names).size).toBe(2)
})

// the insert size is the band on the gel, so it has to be the product's span
test('TLEN is the product size, signed by which mate is leftmost', () => {
  const [low, high] = records('+')
  expect(low!.tlen).toBe(147)
  expect(high!.tlen).toBe(-147)
})

// A primer pair converges whatever strand the product is reported on. Only which
// primer is read 1 follows the strand.
test.each([
  ['+' as const, 64, 128],
  ['-' as const, 128, 64],
])(
  'on a %s product the footprints still face inward',
  (sign, lowMate, highMate) => {
    const [low, high] = records(sign)
    // low mate reads rightward: not reverse, and its mate is
    expect(low!.flag & 16).toBe(0)
    expect(low!.flag & 32).toBe(32)
    // high mate reads leftward, and its mate does not
    expect(high!.flag & 16).toBe(16)
    expect(high!.flag & 32).toBe(0)
    // the forward primer is read 1, so which mate that is swaps with the strand
    expect(low!.flag & 192).toBe(lowMate)
    expect(high!.flag & 192).toBe(highMate)
  },
)

// SEQ is reference-forward, so the high footprint is stored complemented — this
// is what makes a primer/template mismatch land on the right base
test('each footprint carries its own bases in reference orientation', () => {
  const plus = records('+')
  expect(plus[0]!.seq).toBe(FWD)
  expect(plus[0]!.cigar).toBe(`${FWD.length}M`)
  expect(plus[1]!.seq).toBe(revcom(REV))

  // on a minus product the primers change ends, so the sequences follow
  const minus = records('-')
  expect(minus[0]!.seq).toBe(REV)
  expect(minus[1]!.seq).toBe(revcom(FWD))
})

test('states no @SQ, since hgPcr reports no chromosome sizes', () => {
  expect(ispcrToSam(parseIsPcrProducts(response('+')))).not.toContain('@SQ')
})
