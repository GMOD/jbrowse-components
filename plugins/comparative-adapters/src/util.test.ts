import { csToCigar, flipCigar, pafIdentity } from './util.ts'

test('flip cigar', () => {
  expect(flipCigar('3M5D5M5I6M')).toEqual('6M5D5M5I3M')
})

describe('csToCigar', () => {
  test('short form match run', () => {
    expect(csToCigar(':6')).toBe('6=')
  })

  test('short form with substitution, insertion, deletion', () => {
    // 6 match, C->T sub, 4 match, insert gtc, 3 match, delete a
    expect(csToCigar(':6*ct:4+gtc:3-a')).toBe('6=1X4=3I3=1D')
  })

  test('coalesces adjacent substitutions', () => {
    expect(csToCigar(':2*ct*ga:2')).toBe('2=2X2=')
  })

  test('long form (=SEQ) match runs', () => {
    expect(csToCigar('=ACGT*ct=AC')).toBe('4=1X2=')
  })

  test('splice/intron (~) becomes N', () => {
    expect(csToCigar(':5~gt10ag:5')).toBe('5=10N5=')
  })

  test('flips like a cg CIGAR', () => {
    expect(flipCigar(csToCigar(':6+gtc:3'))).toBe('3=3D6=')
  })
})

describe('pafIdentity', () => {
  test('prefers de:f: tag (1 - de)', () => {
    expect(
      pafIdentity({ de: 0.02, numMatches: 50, blockLen: 100 }),
    ).toBeCloseTo(0.98)
  })

  test('falls back to id:f: (fraction)', () => {
    expect(pafIdentity({ id: 0.95, numMatches: 50, blockLen: 100 })).toBe(0.95)
  })

  test('falls back to id:f: as percentage', () => {
    expect(pafIdentity({ id: 95, numMatches: 50, blockLen: 100 })).toBe(0.95)
  })

  test('falls back to numMatches/blockLen', () => {
    expect(pafIdentity({ numMatches: 95, blockLen: 100 })).toBe(0.95)
  })

  test('returns 0 when blockLen is missing', () => {
    expect(pafIdentity({})).toBe(0)
  })

  test('ignores invalid de values', () => {
    expect(pafIdentity({ de: 2, numMatches: 90, blockLen: 100 })).toBe(0.9)
  })
})
