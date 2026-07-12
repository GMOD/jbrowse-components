import { phaseSignal } from './detectPhased.ts'

describe('phaseSignal', () => {
  it('detects phased genotypes', () => {
    expect(phaseSignal({ a: '0|1', b: '1|0' })).toBe('phased')
    expect(phaseSignal({ a: '0|0' })).toBe('phased')
  })

  it('detects unphased genotypes', () => {
    expect(phaseSignal({ a: '0/1', b: '1/0' })).toBe('unphased')
    expect(phaseSignal({ a: '0/0' })).toBe('unphased')
  })

  it('is not fooled by a leading no-call in a phased file', () => {
    // The old first-sample-only check returned unphased here because './.'
    // has no pipe.
    expect(phaseSignal({ a: './.', b: '0|1' })).toBe('phased')
  })

  it('returns unknown for an all-missing variant so the caller keeps scanning', () => {
    expect(phaseSignal({ a: './.', b: '.' })).toBe('unknown')
  })

  it('reads phase from a partially-missing phased call', () => {
    expect(phaseSignal({ a: '0|.', b: './.' })).toBe('phased')
  })
})
