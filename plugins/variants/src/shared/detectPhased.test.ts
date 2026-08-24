import { phaseSignal, resolveLDMethod } from './detectPhased.ts'

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

describe('resolveLDMethod', () => {
  it('takes the most precise estimator each file supports under auto', () => {
    expect(resolveLDMethod(true, 'auto')).toBe('phased')
    expect(resolveLDMethod(false, 'auto')).toBe('composite')
  })

  it('honours a composite request on phased data', () => {
    // The point of the slot: a phased panel computed the way an unphased cohort
    // is, so the two are comparable.
    expect(resolveLDMethod(true, 'composite')).toBe('composite')
  })

  it('declines a phased request on unphased data rather than failing', () => {
    // There are no gametes to count, so this cannot be honoured; falling back
    // is what keeps `method` on the result the only thing worth reading.
    expect(resolveLDMethod(false, 'phased')).toBe('composite')
  })
})
