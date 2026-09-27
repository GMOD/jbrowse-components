import SimpleFeature from './simpleFeature.ts'
import {
  junctionEnds,
  svClassOf,
  svClassOfAlt,
  svClassOfToken,
} from './svAlt.ts'

function vcf(alts: string[], info: Record<string, unknown[]> = {}) {
  return new SimpleFeature({
    uniqueId: 'v',
    refName: 'chr1',
    start: 999,
    end: 1000,
    ALT: alts,
    INFO: info,
  })
}

function paired(fields: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: 'p',
    refName: 'chr1',
    start: 10,
    end: 20,
    ...fields,
  })
}

test('a breakend reads both directions off its ALT', () => {
  expect(junctionEnds(vcf(['N[chr2:2000[']))).toEqual({
    own: { refName: 'chr1', pos: 999, keeps: -1 },
    mate: { refName: 'chr2', pos: 1999, keeps: 1 },
  })
})

test('a record with two alleles reads the one it is asked for', () => {
  const feature = vcf(['N[chr2:2000[', ']chr3:5000]N'])
  expect(junctionEnds(feature)?.mate.refName).toBe('chr2')
  expect(junctionEnds(feature, ']chr3:5000]N')?.mate).toEqual({
    refName: 'chr3',
    pos: 4999,
    keeps: -1,
  })
})

test('a deletion keeps the sequence outside it and a duplication the sequence inside', () => {
  expect(junctionEnds(vcf(['<DEL>'], { END: [1500] }))).toEqual({
    own: { refName: 'chr1', pos: 999, keeps: -1 },
    mate: { refName: 'chr1', pos: 1499, keeps: 1 },
  })
  const dup = junctionEnds(vcf(['<DUP:TANDEM>'], { END: [1500] }))
  expect([dup?.own.keeps, dup?.mate.keeps]).toEqual([1, -1])
})

// VCF 4.5 made END a computed field, so a file may state only SVLEN, one
// value per ALT and read as its absolute value
test('a symbolic allele with no END ends SVLEN bases past POS', () => {
  expect(junctionEnds(vcf(['<DEL>'], { SVLEN: [500] }))?.mate.pos).toBe(1499)
  expect(junctionEnds(vcf(['<DEL>'], { SVLEN: [-500] }))?.mate.pos).toBe(1499)
  expect(
    junctionEnds(vcf(['<DEL>'], { END: [1200], SVLEN: [500] }))?.mate.pos,
  ).toBe(1199)
  const repeat = vcf(['<CNV:TR>', '<CNV:TR>'], { SVLEN: [300, 700] })
  expect(junctionEnds(repeat, '<CNV:TR>', 1)?.mate.pos).toBe(1699)
  expect(junctionEnds(vcf(['<INS>'], { SVLEN: [500] }))).toBeUndefined()
})

test('a translocation takes its directions from STRANDS, and none without it', () => {
  const tra = (info: Record<string, unknown[]>) =>
    junctionEnds(vcf(['<TRA>'], { CHR2: ['chr5'], END: [300], ...info }))
  expect(tra({ STRANDS: ['+-'] })).toEqual({
    own: { refName: 'chr1', pos: 999, keeps: -1 },
    mate: { refName: 'chr5', pos: 299, keeps: 1 },
  })
  expect([tra({})?.own.keeps, tra({})?.mate.keeps]).toEqual([0, 0])
})

test('a BEDPE row puts each junction on the block edge its strand names', () => {
  expect(
    junctionEnds(
      paired({
        strand: 1,
        mate: { refName: 'chr2', start: 30, end: 40, strand: -1 },
      }),
    ),
  ).toEqual({
    own: { refName: 'chr1', pos: 19, keeps: -1 },
    mate: { refName: 'chr2', pos: 30, keeps: 1 },
  })
})

test('a stated direction outranks a strand', () => {
  const ends = junctionEnds(
    paired({
      strand: 1,
      mateDirection: 1,
      mate: { refName: 'chr2', start: 30, end: 40, strand: -1 },
    }),
  )
  expect(ends?.own).toEqual({ refName: 'chr1', pos: 10, keeps: 1 })
})

// PAF's strand is the query's orientation against the target, not a side of
// either block, and its mate states none.
test('a strand on one end only names no side, and the blocks face each other', () => {
  expect(
    junctionEnds(
      paired({ strand: -1, mate: { refName: 'chr1', start: 30, end: 40 } }),
    ),
  ).toEqual({
    own: { refName: 'chr1', pos: 19, keeps: 0 },
    mate: { refName: 'chr1', pos: 30, keeps: 0 },
  })
})

test('a record naming no other end has none', () => {
  expect(junctionEnds(vcf(['A']))).toBeUndefined()
  expect(junctionEnds(paired({}))).toBeUndefined()
})

describe('svClassOfToken', () => {
  test.each([
    ['DEL:ME:ALU', 'DEL'],
    ['dup:tandem', 'DUP'],
    ['INS:ME', 'INS'],
    ['CNV:TR', 'TR'],
    ['STR12', 'TR'],
    ['VNTR', 'TR'],
    ['TRA', 'BND'],
    ['CTX', 'BND'],
    ['INVDUP', 'CPX'],
    ['INV:DUP', 'CPX'],
    ['CHROMOTHRIPSIS', 'CPX'],
    ['CN0', 'DEL'],
    ['CN1', 'CNV'],
    ['CN3', 'DUP'],
    ['DUP/INS', 'OTHER'],
    ['.', ''],
  ])('%s is %s', (token, cls) => {
    expect(svClassOfToken(token)).toBe(cls)
  })
})

describe('svClassOfAlt', () => {
  test('a symbolic allele names its own class over SVTYPE', () => {
    expect(svClassOfAlt('<DEL>', { info: { SVTYPE: ['DUP'] } })).toBe('DEL')
  })
  test('a breakend takes the event its record declares', () => {
    expect(svClassOfAlt('N[chr2:100[', { info: { SVTYPE: ['DEL'] } })).toBe(
      'DEL',
    )
    expect(svClassOfAlt('N[chr2:100[', { info: { SVTYPE: ['BND'] } })).toBe(
      'BND',
    )
    expect(
      svClassOfAlt('N[chr2:100[', {
        info: { EVENTTYPE: ['INV'], SVTYPE: ['BND'] },
      }),
    ).toBe('INV')
  })
  test('a sequence allele is structural by its length against REF', () => {
    expect(svClassOfAlt('A'.repeat(60), { ref: 'A' })).toBe('INS')
    expect(svClassOfAlt('A', { ref: 'A'.repeat(60) })).toBe('DEL')
    expect(svClassOfAlt('T', { ref: 'A' })).toBe('')
  })
  test('the allele its caller names reads its own entry of a per-allele field', () => {
    const info = { EVENTTYPE: ['DEL', 'INV'] }
    expect(svClassOfAlt('N[chr2:100[', { info, alleleIndex: 1 })).toBe('INV')
  })
  test('an allele standing for any other names nothing', () => {
    expect(svClassOfAlt('<NON_REF>')).toBe('')
  })
})

describe('svClassOf', () => {
  const record = (ALT: string[], INFO: Record<string, unknown[]> = {}) =>
    new SimpleFeature({
      uniqueId: 'r',
      refName: 'chr1',
      start: 0,
      end: 1,
      ALT,
      INFO,
      REF: 'A',
    })
  test('losses and gains of one segment are a copy-number variant', () => {
    expect(svClassOf(record(['<DEL>', '<DUP>']))).toBe('CNV')
    expect(svClassOf(record(['<CN0>', '<CN2>']))).toBe('CNV')
  })
  test('alleles that otherwise disagree are other', () => {
    expect(svClassOf(record(['<DEL>', '<INV>']))).toBe('OTHER')
  })
  test('a record with no allele reads its SVTYPE', () => {
    expect(svClassOf(record([], { SVTYPE: ['INV'] }))).toBe('INV')
  })
  test('a small variant is not structural', () => {
    expect(svClassOf(record(['T']))).toBe('')
    expect(svClassOf(record([`A${'C'.repeat(48)}`]))).toBe('')
  })
  test('a sequence allele takes its SVTYPE where its length says nothing', () => {
    const noRef = new SimpleFeature({
      uniqueId: 'r',
      refName: 'chr1',
      start: 0,
      end: 1,
      ALT: ['ACGT'],
      INFO: { SVTYPE: ['DEL'] },
    })
    expect(svClassOf(noRef)).toBe('DEL')
  })
  // a decomposed pangenome callset spells its SVs as plain sequence alleles
  // with no symbolic ALT and no SVTYPE
  test('two SV-sized insertions are one insertion', () => {
    expect(
      svClassOf(record([`A${'C'.repeat(60)}`, `A${'G'.repeat(60)}`])),
    ).toBe('INS')
  })
  test('an allele standing for any other leaves the record its others', () => {
    expect(svClassOf(record(['<NON_REF>']))).toBe('')
    expect(svClassOf(record(['<DEL>', '<*>']))).toBe('DEL')
  })
})
