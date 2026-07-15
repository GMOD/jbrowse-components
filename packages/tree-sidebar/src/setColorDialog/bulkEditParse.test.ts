import {
  mergeParsedRows,
  parseRowsByName,
  toCSV,
  unmatchedNames,
} from './bulkEditParse.ts'

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

  it('handles quoted fields containing commas', () => {
    expect(
      parseRowsByName('name,label\n"Sample A,B","Label, with comma"'),
    ).toEqual({
      'Sample A,B': { name: 'Sample A,B', label: 'Label, with comma' },
    })
  })

  it('handles escaped double quotes inside quoted fields', () => {
    expect(parseRowsByName('name,note\n"say ""hi""",test')).toEqual({
      'say "hi"': { name: 'say "hi"', note: 'test' },
    })
  })

  it('auto-detects tab delimiter', () => {
    expect(parseRowsByName('name\tcolor\nHG1\t#f00')).toEqual({
      HG1: { name: 'HG1', color: '#f00' },
    })
  })
})

describe('mergeParsedRows', () => {
  const layout = [
    { name: 'HG1', color: 'red', source: 'HG1' },
    { name: 'HG2', color: 'blue', source: 'HG2' },
  ]
  const byName = { HG1: { name: 'HG1', pop: 'GBR' } }

  it('patches parsed fields over existing rows, preserving name', () => {
    expect(mergeParsedRows(layout, byName, false)).toEqual([
      { name: 'HG1', color: 'red', source: 'HG1', pop: 'GBR' },
      { name: 'HG2', color: 'blue', source: 'HG2' },
    ])
  })

  it('drops existing fields for matched rows when replace=true', () => {
    expect(mergeParsedRows(layout, byName, true)).toEqual([
      { name: 'HG1', pop: 'GBR' },
      { name: 'HG2', color: 'blue', source: 'HG2' }, // unmatched → unchanged
    ])
  })

  it('always keeps unmatched rows unchanged in replace mode', () => {
    const out = mergeParsedRows(layout, {}, true)
    expect(out).toEqual(layout)
  })
})

describe('unmatchedNames', () => {
  it('returns names in paste that are not in the layout', () => {
    const layout = [{ name: 'HG1' }, { name: 'HG2' }]
    const byName = { HG1: { name: 'HG1' }, Ghost: { name: 'Ghost' } }
    expect(unmatchedNames(layout, byName)).toEqual(['Ghost'])
  })

  it('returns empty array when all names match', () => {
    const layout = [{ name: 'HG1' }]
    const byName = { HG1: { name: 'HG1' } }
    expect(unmatchedNames(layout, byName)).toEqual([])
  })
})

describe('toCSV', () => {
  it('serializes rows to CSV with a header, omitting source', () => {
    const rows = [
      { name: 'HG1', color: 'red', source: 'HG1' },
      { name: 'HG2', color: 'blue', source: 'HG2' },
    ]
    const csv = toCSV(rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('name,color')
    expect(lines[1]).toBe('HG1,red')
  })

  it('quotes fields containing commas', () => {
    const rows = [{ name: 'A,B', color: '' }]
    const csv = toCSV(rows)
    expect(csv).toContain('"A,B"')
  })

  it('omits baseUri from export', () => {
    const rows = [{ name: 'HG1', baseUri: 'http://x', color: 'red' }]
    const csv = toCSV(rows)
    expect(csv).not.toContain('baseUri')
  })

  it('round-trips through parseRowsByName', () => {
    const rows = [
      { name: 'HG1', color: '#f00', group: 'tumor' },
      { name: 'HG2', color: '', group: 'normal' },
    ]
    const csv = toCSV(rows)
    const parsed = parseRowsByName(csv)
    expect(parsed.HG1).toEqual({
      name: 'HG1',
      color: '#f00',
      group: 'tumor',
    })
    expect(parsed.HG2).toEqual({ name: 'HG2', color: '', group: 'normal' })
  })
})
