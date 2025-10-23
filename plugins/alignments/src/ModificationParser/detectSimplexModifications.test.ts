import { detectSimplexModifications } from './detectSimplexModifications'

describe('detectSimplexModifications', () => {
  it('should identify simplex modification (C+m without G-m)', () => {
    const modifications = [
      { type: 'm', base: 'C', strand: '+' },
      { type: 'h', base: 'C', strand: '+' },
    ]
    const result = detectSimplexModifications(modifications)
    expect(result).toEqual(new Set(['m', 'h']))
  })

  it('should identify duplex modification (C+m with G-m)', () => {
    const modifications = [
      { type: 'm', base: 'C', strand: '+' },
      { type: 'm', base: 'G', strand: '-' },
    ]
    const result = detectSimplexModifications(modifications)
    expect(result).toEqual(new Set())
  })

  it('should handle 6mA duplex (A+a with T-a)', () => {
    const modifications = [
      { type: 'a', base: 'A', strand: '+' },
      { type: 'a', base: 'T', strand: '-' },
    ]
    const result = detectSimplexModifications(modifications)
    expect(result).toEqual(new Set())
  })

  it('should handle mixed simplex and duplex', () => {
    const modifications = [
      { type: 'm', base: 'C', strand: '+' }, // simplex
      { type: 'a', base: 'A', strand: '+' }, // duplex
      { type: 'a', base: 'T', strand: '-' }, // duplex
    ]
    const result = detectSimplexModifications(modifications)
    expect(result).toEqual(new Set(['m']))
  })

  it('should handle only negative strand modifications', () => {
    const modifications = [{ type: 'a', base: 'T', strand: '-' }]
    const result = detectSimplexModifications(modifications)
    expect(result).toEqual(new Set())
  })

  it('should handle empty modifications', () => {
    const modifications: Array<{ type: string; base: string; strand: string }> =
      []
    const result = detectSimplexModifications(modifications)
    expect(result).toEqual(new Set())
  })

  it('should handle multiple modification types', () => {
    const modifications = [
      { type: 'm', base: 'C', strand: '+' }, // simplex
      { type: 'h', base: 'C', strand: '+' }, // duplex
      { type: 'h', base: 'G', strand: '-' }, // duplex
      { type: 'a', base: 'A', strand: '+' }, // duplex
      { type: 'a', base: 'T', strand: '-' }, // duplex
    ]
    const result = detectSimplexModifications(modifications)
    expect(result).toEqual(new Set(['m']))
  })
})
