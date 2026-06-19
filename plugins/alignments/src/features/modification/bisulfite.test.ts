import { methylated5mC } from '@jbrowse/core/ui/theme'
import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'

import { extractBisulfite } from './extract.ts'

import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'
import type { CytosineContext } from '@jbrowse/modifications-utils'

// reference (lowercase, as the worker lowercases it). Cytosine contexts:
//   index: 0 1 2 3 4 5 6 7 8 9 10 11
//   base:  a c g a c a g a c a t  t
//   pos1 C followed by G            -> CpG
//   pos4 C, A, then G (pos6)        -> CHG
//   pos8 C, A, then T              -> CHH
// On the bottom strand the G at pos2 is the CpG partner; the G at pos6 is a CHG.
const REF = 'acgacagacatt'

const [METH_R, METH_G, METH_B] = cssColorToRgb(methylated5mC)
const isMeth = (e: ModificationEntry) =>
  e.r === METH_R && e.g === METH_G && e.b === METH_B

function run(
  opts: { strand: number; flags: number; seq: string },
  context: CytosineContext,
) {
  const out: ModificationEntry[] = []
  const feature = new SimpleFeature({
    uniqueId: 'r1',
    refName: 'ctg',
    start: 0,
    end: REF.length,
    strand: opts.strand,
    CIGAR: `${REF.length}M`,
    seq: opts.seq,
    flags: opts.flags,
  })
  extractBisulfite(
    feature,
    0,
    0,
    opts.strand,
    { refName: 'ctg', start: 0, end: REF.length, assemblyName: 'a' },
    REF,
    0,
    context,
    out,
  )
  return out
}

describe('extractBisulfite forward read (examines reference C)', () => {
  // read C=methylated, T=unmethylated at each reference cytosine
  // pos1 C(meth), pos4 T(unmeth), pos8 C(meth)
  const fwd = { strand: 1, flags: 0, seq: 'ACGATAGACATT' }

  test('CpG: methylated call at pos1', () => {
    const out = run(fwd, 'CG')
    expect(out.map(e => e.position)).toEqual([1])
    expect(isMeth(out[0]!)).toBe(true)
  })

  test('CHG: unmethylated call at pos4', () => {
    const out = run(fwd, 'CHG')
    expect(out.map(e => e.position)).toEqual([4])
    expect(isMeth(out[0]!)).toBe(false)
  })

  test('CHH: methylated call at pos8', () => {
    const out = run(fwd, 'CHH')
    expect(out.map(e => e.position)).toEqual([8])
    expect(isMeth(out[0]!)).toBe(true)
  })

  test('all contexts: three calls', () => {
    expect(run(fwd, 'all').map(e => e.position)).toEqual([1, 4, 8])
  })
})

describe('reverse read (flip -> examines reference G)', () => {
  // examine genomic G: read G=methylated, A=unmethylated
  // pos2 G(meth, CpG partner), pos6 A(unmeth, CHG partner)
  const rev = { strand: -1, flags: 16, seq: 'ACGACAAACATT' }

  test('CpG: methylated call at the G of pos2', () => {
    const out = run(rev, 'CG')
    expect(out.map(e => e.position)).toEqual([2])
    expect(isMeth(out[0]!)).toBe(true)
  })

  test('CHG: unmethylated call at pos6', () => {
    const out = run(rev, 'CHG')
    expect(out.map(e => e.position)).toEqual([6])
    expect(isMeth(out[0]!)).toBe(false)
  })
})

describe('second-of-pair forward read flips to reference G', () => {
  // forward strand but second-of-pair => flip (reverse XOR secondOfPair = true)
  // so it examines reference G just like a reverse read
  const r2 = { strand: 1, flags: 0x1 | 0x80, seq: 'ACGACAAACATT' }

  test('CpG: methylated call at pos2 despite forward strand', () => {
    const out = run(r2, 'CG')
    expect(out.map(e => e.position)).toEqual([2])
    expect(isMeth(out[0]!)).toBe(true)
  })
})

test('non-C/T read base at a reference C is not called', () => {
  // reference C at pos1, but the read shows G (a SNP) -> not informative
  const out = run({ strand: 1, flags: 0, seq: 'AGGATAGACATT' }, 'CG')
  expect(out).toHaveLength(0)
})
