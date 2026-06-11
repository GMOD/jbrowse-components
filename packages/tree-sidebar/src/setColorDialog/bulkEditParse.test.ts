import { mergeParsedRows, parseRowsByName } from './bulkEditParse.ts'

describe('parseRowsByName', () => {
  it('parses CSV with a name column', () => {
    expect(parseRowsByName('name,pop\nHG1,GBR\nHG2,CHS')).toEqual({
      HG1: { name: 'HG1', pop: 'GBR' },
      HG2: { name: 'HG2', pop: 'CHS' },
    })
  })

  it('parses TSV and ignores blank lines', () => {
    expect(parseRowsByName('name\tpop\n\nHG1\tGBR\n  \n')).toEqual({
      HG1: { name: 'HG1', pop: 'GBR' },
    })
  })

  it('pads missing trailing columns with empty strings', () => {
    expect(parseRowsByName('name,pop\nHG1')).toEqual({
      HG1: { name: 'HG1', pop: '' },
    })
  })

  it('skips data rows with no name value', () => {
    expect(parseRowsByName('name,pop\n,GBR\nHG1,CHS')).toEqual({
      HG1: { name: 'HG1', pop: 'CHS' },
    })
  })

  it('throws a clear error on empty/whitespace input', () => {
    expect(() => parseRowsByName('')).toThrow(/Nothing pasted/)
    expect(() => parseRowsByName('   \n  ')).toThrow(/Nothing pasted/)
  })

  it('throws when the header lacks a name column', () => {
    expect(() => parseRowsByName('pop,color\nGBR,red')).toThrow(/name/)
  })
})

describe('mergeParsedRows', () => {
  const layout = [
    { name: 'HG1', color: 'red' },
    { name: 'HG2', color: 'blue' },
  ]
  const byName = { HG1: { name: 'HG1', pop: 'GBR' } }

  it('patches parsed fields over existing rows, preserving name', () => {
    expect(mergeParsedRows(layout, byName, false)).toEqual([
      { name: 'HG1', color: 'red', pop: 'GBR' },
      { name: 'HG2', color: 'blue' },
    ])
  })

  it('drops existing fields when replace=true', () => {
    expect(mergeParsedRows(layout, byName, true)).toEqual([
      { name: 'HG1', pop: 'GBR' },
      { name: 'HG2' },
    ])
  })
})
