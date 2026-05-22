import { csToCigar, flipCs } from './csUtils.ts'

describe('csToCigar', () => {
  it('converts match runs', () => {
    expect(csToCigar(':100')).toBe('100=')
    expect(csToCigar(':50:30')).toBe('50=30=')
  })

  it('converts substitutions', () => {
    expect(csToCigar('*ac')).toBe('1X')
    expect(csToCigar('*ac*gt')).toBe('1X1X')
  })

  it('converts insertions and deletions', () => {
    expect(csToCigar('+acgt')).toBe('4I')
    expect(csToCigar('-acgt')).toBe('4D')
    expect(csToCigar('+a')).toBe('1I')
    expect(csToCigar('-tt')).toBe('2D')
  })

  it('converts mixed operations', () => {
    expect(csToCigar(':100*ac:50+ggg:200')).toBe('100=1X50=3I200=')
  })

  it('handles complex cs from GFA bubble', () => {
    expect(csToCigar(':12*gt*gt*ca*ca*ac*ac*tg*tg*gt*gt*ca*ca:12:12')).toBe(
      '12=1X1X1X1X1X1X1X1X1X1X1X1X12=12=',
    )
  })

  it('handles deletion followed by insertion', () => {
    expect(csToCigar(':100-acgt+tttt:50')).toBe('100=4D4I50=')
  })

  it('handles empty string', () => {
    expect(csToCigar('')).toBe('')
  })

  it('skips zero-length match', () => {
    expect(csToCigar(':0:100')).toBe('100=')
  })

  it('handles long sequences', () => {
    expect(csToCigar('+acgtacgtacgtacgtacgt')).toBe('20I')
    expect(csToCigar('-nnnnnnnnnnnnnnnnnnn')).toBe('19D')
  })
})

describe('flipCs', () => {
  it('preserves match runs', () => {
    expect(flipCs(':100')).toBe(':100')
    expect(flipCs(':50:30')).toBe(':50:30')
  })

  it('swaps substitution bases', () => {
    expect(flipCs('*ac')).toBe('*ca')
    expect(flipCs('*gt')).toBe('*tg')
  })

  it('swaps insertions and deletions', () => {
    expect(flipCs('+acgt')).toBe('-acgt')
    expect(flipCs('-acgt')).toBe('+acgt')
  })

  it('handles mixed operations', () => {
    expect(flipCs(':100*ac+ggg-tt:50')).toBe(':100*ca-ggg+tt:50')
  })

  it('handles empty string', () => {
    expect(flipCs('')).toBe('')
  })

  it('is its own inverse', () => {
    const cs = ':100*ac+ggg-tt:50*gt'
    expect(flipCs(flipCs(cs))).toBe(cs)
  })
})
