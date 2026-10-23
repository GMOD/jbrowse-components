import {
  ignoredColumns,
  mergeParsedRows,
  parseRowsByName,
  toCSV,
  unmatchedNames,
} from './bulkEditParse.ts'

describe('parseRowsByName', () => {
  it('parses CSV with a name column', () => {
    expect(parseRowsByName('name,pop\nHG1,GBR\nHG2,CHS')).toEqual(
      new Map([
        ['HG1', { name: 'HG1', pop: 'GBR' }],
        ['HG2', { name: 'HG2', pop: 'CHS' }],
      ]),
    )
  })

  it('parses TSV and ignores blank lines', () => {
    expect(parseRowsByName('name\tpop\n\nHG1\tGBR\n  \n')).toEqual(
      new Map([['HG1', { name: 'HG1', pop: 'GBR' }]]),
    )
  })

  it('pads missing trailing columns with empty strings', () => {
    expect(parseRowsByName('name,pop\nHG1')).toEqual(
      new Map([['HG1', { name: 'HG1', pop: '' }]]),
    )
  })

  it('skips data rows with no name value', () => {
    expect(parseRowsByName('name,pop\n,GBR\nHG1,CHS')).toEqual(
      new Map([['HG1', { name: 'HG1', pop: 'CHS' }]]),
    )
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
    ).toEqual(
      new Map([
        ['Sample A,B', { name: 'Sample A,B', label: 'Label, with comma' }],
      ]),
    )
  })

  it('handles escaped double quotes inside quoted fields', () => {
    expect(parseRowsByName('name,note\n"say ""hi""",test')).toEqual(
      new Map([['say "hi"', { name: 'say "hi"', note: 'test' }]]),
    )
  })

  it('auto-detects tab delimiter', () => {
    expect(parseRowsByName('name\tcolor\nHG1\t#f00')).toEqual(
      new Map([['HG1', { name: 'HG1', color: '#f00' }]]),
    )
  })

  // A leading tab is an empty first cell, not padding: trimming it shifted every
  // column left, so the row was filed under the color or dropped entirely.
  it('keeps an empty leading cell in a TSV row', () => {
    expect(parseRowsByName('group\tname\tcolor\n\tHG1\t#f00')).toEqual(
      new Map([['HG1', { group: '', name: 'HG1', color: '#f00' }]]),
    )
  })

  it('keeps an empty leading cell in a CSV row', () => {
    expect(parseRowsByName('group,name,color\n,HG1,#f00')).toEqual(
      new Map([['HG1', { group: '', name: 'HG1', color: '#f00' }]]),
    )
  })

  it('strips carriage returns from CRLF input', () => {
    expect(parseRowsByName('name\tcolor\r\nHG1\t#f00\r\n')).toEqual(
      new Map([['HG1', { name: 'HG1', color: '#f00' }]]),
    )
  })
})

describe('mergeParsedRows', () => {
  const layout = [
    { name: 'HG1', label: 'one', rowColor: 'red', group: 'GBR' },
    { name: 'HG2', label: 'two', rowColor: 'blue', group: 'CHS' },
  ]

  it('sets the label and rowColor columns, and nothing else', () => {
    const byName = new Map([
      ['HG1', { name: 'HG1', label: 'uno', group: 'YRI' }],
    ])
    expect(mergeParsedRows(layout, byName, false)).toEqual([
      { name: 'HG1', label: 'uno', rowColor: 'red', group: 'GBR' },
      layout[1],
    ])
  })

  it('unsets fields whose pasted cell is blank', () => {
    const merged = mergeParsedRows(
      layout,
      new Map([['HG1', { name: 'HG1', rowColor: '' }]]),
      false,
    )
    expect(merged[0]!.rowColor).toBeUndefined()
  })

  it('round-trips toCSV through Update rows', () => {
    const rows = [
      { name: 'HG1', label: undefined, rowColor: undefined, group: 'GBR' },
      { name: 'HG2', label: 'two', rowColor: '#ff0000', group: 'CHS' },
    ]
    expect(mergeParsedRows(rows, parseRowsByName(toCSV(rows)), false)).toEqual(
      rows,
    )
  })

  it('clears the label and rowColor the paste omits when replace=true', () => {
    const byName = new Map([['HG1', { name: 'HG1', label: 'uno' }]])
    expect(mergeParsedRows(layout, byName, true)).toEqual([
      { name: 'HG1', label: 'uno', rowColor: undefined, group: 'GBR' },
      layout[1],
    ])
  })

  it('always keeps unmatched rows unchanged in replace mode', () => {
    const out = mergeParsedRows(layout, new Map(), true)
    expect(out).toEqual(layout)
  })

  // Row names are arbitrary strings out of somebody's data file. Looked up in a
  // plain object, one that collides with `Object.prototype` came back with an
  // inherited function rather than `undefined`, so the row counted as matched by
  // a paste that never named it — and "Replace rows" then started from `{}` and
  // dropped every field it had.
  it('does not treat a row named after an Object.prototype member as matched', () => {
    const rows = [
      { name: 'constructor', color: 'red' },
      { name: 'toString', color: 'blue' },
      { name: 'HG1', color: 'green' },
    ]
    expect(mergeParsedRows(rows, new Map(), true)).toEqual(rows)
  })
})

describe('unmatchedNames', () => {
  it('returns names in paste that are not in the layout', () => {
    const layout = [{ name: 'HG1' }, { name: 'HG2' }]
    const byName = new Map([
      ['HG1', { name: 'HG1' }],
      ['Ghost', { name: 'Ghost' }],
    ])
    expect(unmatchedNames(layout, byName)).toEqual(['Ghost'])
  })

  it('returns empty array when all names match', () => {
    const layout = [{ name: 'HG1' }]
    const byName = new Map([['HG1', { name: 'HG1' }]])
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

  // The export advertises the row shape, so a field nobody has set yet still
  // gets a header the user can fill in. This is the one place that wants the
  // full key union rather than the populated-only columns the grid shows.
  it('exports a header for a field no row has set', () => {
    const rows = [
      { name: 'HG1', color: 'red', group: undefined },
      { name: 'HG2', color: 'blue', group: undefined },
    ]
    expect(toCSV(rows).split('\n')[0]).toBe('name,color,group')
  })

  it('round-trips through parseRowsByName', () => {
    const rows = [
      { name: 'HG1', color: '#f00', group: 'tumor' },
      { name: 'HG2', color: '', group: 'normal' },
    ]
    const csv = toCSV(rows)
    const parsed = parseRowsByName(csv)
    expect(parsed.get('HG1')).toEqual({
      name: 'HG1',
      color: '#f00',
      group: 'tumor',
    })
    expect(parsed.get('HG2')).toEqual({
      name: 'HG2',
      color: '',
      group: 'normal',
    })
  })
})

describe('ignoredColumns', () => {
  const layout = [{ name: 'HG1', group: 'GBR', label: 'one' }]

  it('names a column whose pasted value would change a row', () => {
    const byName = parseRowsByName('name,group,label\nHG1,YRI,uno')
    expect(ignoredColumns(layout, byName)).toEqual(['group'])
  })

  it('passes a column pasted back unchanged', () => {
    expect(ignoredColumns(layout, parseRowsByName(toCSV(layout)))).toEqual([])
  })
})
