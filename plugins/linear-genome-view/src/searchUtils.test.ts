import { checkRef, splitLast } from './searchUtils.ts'

const volvoxRefs = new Set(['ctgA', 'ctgB', 'ctga', 'ctgb'])

describe('checkRef', () => {
  it('accepts a plain refName present in the set', () => {
    expect(checkRef('ctgA', volvoxRefs)).toBe(true)
  })

  it('accepts a lowercase variant present in the set', () => {
    expect(checkRef('ctga', volvoxRefs)).toBe(true)
  })

  it('accepts a locstring whose refName is in the set', () => {
    expect(checkRef('ctgA:1000', volvoxRefs)).toBe(true)
  })

  it('accepts a locstring with a range whose refName is in the set', () => {
    expect(checkRef('ctgA:1000-2000', volvoxRefs)).toBe(true)
  })

  it('rejects a gene label not in the ref set', () => {
    expect(checkRef('Apple3', volvoxRefs)).toBe(false)
  })

  it('rejects a locstring with a non-numeric suffix', () => {
    expect(checkRef('ctgA:notanumber', volvoxRefs)).toBe(false)
  })

  it('rejects an unknown refName even with a numeric suffix', () => {
    expect(checkRef('unknown:1000', volvoxRefs)).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(checkRef('', volvoxRefs)).toBe(false)
  })
})

describe('splitLast', () => {
  it('splits on the last colon', () => {
    expect(splitLast('ctgA:1000:extra', ':')).toEqual(['ctgA:1000', 'extra'])
  })

  it('returns [str, empty] when separator not found', () => {
    expect(splitLast('ctgA', ':')).toEqual(['ctgA', ''])
  })

  it('splits a simple locstring', () => {
    expect(splitLast('ctgA:1000', ':')).toEqual(['ctgA', '1000'])
  })
})
