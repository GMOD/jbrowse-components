import {
  evaluate,
  formatValue,
  identifiers,
  loadMeasurements,
  parseMeasurement,
  renderTable,
  resolveReference,
  resolveRow,
} from './measurements.ts'

import type { Measurement } from './measurements.ts'

const base = {
  id: 'demo',
  measured: '2026-08-17',
  source: { kind: 'hand', repro: 'node bench.ts' },
  columns: [
    { key: 'case', label: 'case' },
    { key: 'before', label: 'before', format: 'ms' },
    { key: 'after', label: 'after', format: 'ms' },
  ],
  rows: [{ values: { case: 'a', before: 800, after: 400 } }],
}

const parse = (patch: Record<string, unknown>) =>
  parseMeasurement('demo', JSON.stringify({ ...base, ...patch }))

describe('the record format', () => {
  it('accepts a well-formed record', () => {
    expect(parse({}).rows).toHaveLength(1)
  })

  // Provenance is the half a hand-typed table always dropped, so these two are
  // the reason the format exists rather than incidental validation.
  it('requires a measured date', () => {
    expect(() => parse({ measured: 'last tuesday' })).toThrow(/YYYY-MM-DD/)
    expect(() => parse({ measured: undefined })).toThrow(/YYYY-MM-DD/)
  })

  it('requires a way to take the measurement again', () => {
    expect(() => parse({ source: { kind: 'hand' } })).toThrow(/repro/)
  })

  it('requires a jb2bench record to name the file it came from', () => {
    expect(() =>
      parse({ source: { kind: 'jb2bench', repro: 'make x' } }),
    ).toThrow(/source\.from/)
  })

  it('rejects an unknown source kind', () => {
    expect(() => parse({ source: { kind: 'vibes', repro: 'x' } })).toThrow(
      /bench, jb2bench, hand/,
    )
  })

  it('catches a filename that disagrees with the id', () => {
    expect(() => parseMeasurement('other', JSON.stringify(base))).toThrow(
      /but the file is named other/,
    )
  })

  // A key that is not a column is the migration typo, and it renders as a
  // missing cell rather than as an error unless it is caught here.
  it('rejects a row setting a column that does not exist', () => {
    expect(() =>
      parse({ rows: [{ values: { case: 'a', beffore: 1 } }] }),
    ).toThrow(/"beffore", which is not a column/)
  })

  it('rejects emphasis on a column that does not exist', () => {
    expect(() =>
      parse({ rows: [{ values: { case: 'a' }, emphasize: ['nope'] }] }),
    ).toThrow(/emphasizes "nope"/)
  })

  it('rejects duplicate column keys', () => {
    expect(() =>
      parse({
        columns: [
          { key: 'a', label: 'A' },
          { key: 'a', label: 'B' },
        ],
      }),
    ).toThrow(/share the key "a"/)
  })
})

describe('derived columns', () => {
  const withSpeedup = {
    ...base,
    columns: [
      ...base.columns,
      {
        key: 'speedup',
        label: 'speedup',
        format: 'x',
        derived: 'before/after',
      },
    ],
  } as unknown as Measurement

  it('computes rather than reading a typed value', () => {
    expect(resolveRow(withSpeedup, withSpeedup.rows[0]!).speedup).toBe(2)
  })

  // The whole point: re-measuring one arm has to move the ratio beside it.
  it('follows a re-measured input', () => {
    const row = { values: { case: 'a', before: 800, after: 500 } }
    expect(resolveRow(withSpeedup, row).speedup).toBe(1.6)
  })

  it('refuses a row that sets a derived column by hand', () => {
    const row = { values: { case: 'a', before: 8, after: 4, speedup: 9 } }
    expect(() => resolveRow(withSpeedup, row)).toThrow(/which is derived from/)
  })

  // A row that opted out of the measurement must not publish `NaNx`.
  it('leaves a derived cell absent when an input is absent', () => {
    const row = { values: { case: 'a', before: null, after: 4 } }
    expect(resolveRow(withSpeedup, row).speedup).toBeNull()
  })

  it("names a typo'd column instead of reporting NaN", () => {
    const bad = {
      ...base,
      columns: [
        ...base.columns,
        { key: 'r', label: 'r', derived: 'befor/after' },
      ],
    } as unknown as Measurement
    expect(() => resolveRow(bad, bad.rows[0]!)).toThrow(
      /"befor" in "befor\/after" is not a column/,
    )
  })
})

describe('the expression evaluator', () => {
  const scope = { a: 10, b: 4, c: 2 }

  it.each([
    ['a/b', 2.5],
    ['a-b', 6],
    ['a+b*c', 18],
    ['(a+b)*c', 28],
    ['1+b/a', 1.4],
    ['-b+a', 6],
    ['a/b/c', 1.25],
  ])('evaluates %s', (expr, want) => {
    expect(evaluate(expr, scope)).toBe(want)
  })

  it('respects precedence rather than folding left to right', () => {
    expect(evaluate('a+b*c', scope)).not.toBe((10 + 4) * 2)
  })

  it('reports the identifiers an expression reads', () => {
    expect(identifiers('1 + coarse/fine')).toEqual(['coarse', 'fine'])
  })

  it('rejects an expression it cannot parse', () => {
    expect(() => evaluate('a ** b', scope)).toThrow(/cannot parse/)
  })

  it('rejects a trailing operand', () => {
    expect(() => evaluate('a b', scope)).toThrow(/trailing/)
  })

  it('refuses a non-numeric column', () => {
    expect(() => evaluate('a/name', { ...scope, name: 'x' })).toThrow(
      /not a number/,
    )
  })
})

describe('formatting', () => {
  it.each([
    [803, { key: 'k', label: 'k', format: 'ms' }, '803ms'],
    [2732, { key: 'k', label: 'k', format: 'int' }, '2,732'],
    [149307, { key: 'k', label: 'k', format: 'int' }, '149,307'],
    [1109, { key: 'k', label: 'k', format: 'MB' }, '1109 MB'],
    [28, { key: 'k', label: 'k', format: 'percent' }, '28%'],
    [1.17, { key: 'k', label: 'k', format: 'GB' }, '1.17 GB'],
    [143000, { key: 'k', label: 'k', format: 'compact' }, '143k'],
    [1400, { key: 'k', label: 'k', format: 'compact', suffix: ' K' }, '1.4 K'],
    [12, { key: 'k', label: 'k', format: 'compact' }, '12'],
  ] as const)('renders %s as %s', (value, column, want) => {
    expect(formatValue(value, column as never)).toBe(want)
  })

  // A measured value keeps the decimals its author wrote; a derived one gets
  // the column's, because its extra digits are an artifact of the division.
  it('keeps a literal at its own precision and rounds a derived one', () => {
    const column = { key: 'k', label: 'k', format: 'x' } as const
    expect(formatValue(1.4288, column)).toBe('1.4288x')
    expect(formatValue(1.4288, column, { derived: true })).toBe('1.43x')
  })

  it('floors a whole literal at the format precision', () => {
    expect(formatValue(2, { key: 'k', label: 'k', format: 'x' })).toBe('2.00x')
  })

  // The pif table: `0.30` and `0.005` share a column, and a fixed precision
  // either invents a digit or rounds the small one to double its value.
  it('carries two precisions in one ratio column', () => {
    const column = { key: 'k', label: 'k', format: 'ratio' } as const
    expect(formatValue(0.3, column)).toBe('0.30')
    expect(formatValue(0.005, column)).toBe('0.005')
  })

  it('steps a size column up a unit only when it asks to', () => {
    const column = { key: 'k', label: 'k', format: 'MB' } as const
    expect(formatValue(1170, column)).toBe('1170 MB')
    expect(formatValue(1170, { ...column, escalate: true })).toBe('1.17 GB')
  })

  it('passes a string cell through untouched', () => {
    expect(formatValue('12 x 20kb pan', { key: 'k', label: 'k' })).toBe(
      '12 x 20kb pan',
    )
  })
})

// Cells are padded to even columns, so these compare the cells rather than the
// spacing — the padding is checked once, on its own, below.
const cellsOf = (line: string) =>
  line
    .split('|')
    .slice(1, -1)
    .map(c => c.trim())

describe('rendering', () => {
  it('emphasizes only the cells a row names', () => {
    const m = parse({
      rows: [
        {
          values: { case: 'a', before: 800, after: 400 },
          emphasize: ['after'],
        },
      ],
    })
    expect(cellsOf(renderTable(m).at(-1)!)).toEqual(['a', '800ms', '**400ms**'])
  })

  it('renders an absent cell rather than an empty one', () => {
    const m = parse({
      rows: [{ values: { case: 'a', before: null, after: 4 } }],
    })
    expect(cellsOf(renderTable(m).at(-1)!)).toEqual(['a', '—', '4ms'])
  })

  it('right-aligns a column that asks for it', () => {
    const m = parse({
      columns: [
        { key: 'case', label: 'case' },
        { key: 'before', label: 'before', format: 'ms', align: 'right' },
        { key: 'after', label: 'after', format: 'ms' },
      ],
    })
    const [left, right, plain] = cellsOf(renderTable(m)[1]!)
    expect(left!.endsWith(':')).toBe(false)
    expect(right!.endsWith(':')).toBe(true)
    expect(plain!.endsWith(':')).toBe(false)
  })

  // The generated table is read in the editor by whoever checks a measurement,
  // so an unpadded one is a regression against the docs it replaced.
  it('pads every line to one width', () => {
    const m = parse({
      rows: [
        { values: { case: 'a-much-longer-case', before: 8, after: 4 } },
        { values: { case: 'b', before: 800, after: 400 } },
      ],
    })
    const lengths = new Set(renderTable(m).map(l => l.length))
    expect(lengths.size).toBe(1)
  })

  // A row in a transposed table owns its unit: `mount` is milliseconds and
  // `DOM nodes` is a count, in the same `before` column.
  it('lets a row override the column format', () => {
    const m = parse({
      rows: [
        { values: { case: 'mount', before: 1656, after: 1460 } },
        {
          format: 'int',
          values: { case: 'DOM nodes', before: 21506, after: 20505 },
        },
      ],
    })
    expect(cellsOf(renderTable(m)[2]!)).toEqual(['mount', '1656ms', '1460ms'])
    expect(cellsOf(renderTable(m)[3]!)).toEqual([
      'DOM nodes',
      '21,506',
      '20,505',
    ])
  })
})

describe('quoting one value from prose', () => {
  const records = new Map([
    [
      'demo',
      parse({
        columns: [
          { key: 'case', label: 'case' },
          { key: 'before', label: 'before', format: 'ms' },
          { key: 'after', label: 'after', format: 'ms' },
          {
            key: 'speedup',
            label: 'speedup',
            format: 'x',
            derived: 'before/after',
          },
        ],
        rows: [
          { values: { case: '50kb window', before: 800, after: 400 } },
          { values: { case: '12 x 20kb pan', before: 900, after: 600 } },
        ],
      }),
    ],
  ])
  const ref = (r: string) => resolveReference(records, r)

  it('quotes one cell by row and column', () => {
    expect(ref('demo.50kb-window.before')).toBe('800ms')
  })

  it('slugifies a row name the way a reader would write it', () => {
    expect(ref('demo.12-x-20kb-pan.after')).toBe('600ms')
  })

  it('quotes a derived cell at the column precision', () => {
    expect(ref('demo.12-x-20kb-pan.speedup')).toBe('1.50x')
  })

  it.each([
    ['demo.speedup.min', '1.50x'],
    ['demo.speedup.max', '2.00x'],
    ['demo.before.first', '800ms'],
    ['demo.before.last', '900ms'],
    ['demo.before.span', '100ms'],
  ])('aggregates %s', (r, want) => {
    expect(ref(r)).toBe(want)
  })

  // One unit, shared, so the result is the single range `quotedFigures` parses
  // — `1.50-2.00x`, never `1.50x-2.00x`.
  it('renders a range with the unit written once', () => {
    expect(ref('demo.speedup.range')).toBe('1.50-2.00x')
  })

  it.each([
    ['demo.nope.before', /has no row "nope"/],
    ['demo.50kb-window.nope', /has no column "nope"/],
    ['nothing.a.b', /names no measurement "nothing"/],
    ['demo.before', /is not <id>/],
    ['demo.nope.min', /has no column "nope"/],
  ])('reports %s', (r, pattern) => {
    expect(() => ref(r)).toThrow(pattern)
  })

  it('refuses to quote an absent cell', () => {
    const withGap = new Map([
      ['demo', parse({ rows: [{ values: { case: 'a', before: null } }] })],
    ])
    expect(() => resolveReference(withGap, 'demo.a.before')).toThrow(
      /absent cell/,
    )
  })
})

describe('the committed records', () => {
  const records = loadMeasurements()

  it('has records to publish', () => {
    expect(records.size).toBeGreaterThan(0)
  })

  // Loading parses and validates each one, so this is the whole corpus passing
  // the format above. Rendering additionally evaluates every derived column,
  // which is where a re-measured record with a stale expression would fail.
  it('renders every record', () => {
    for (const [id, m] of records) {
      expect({ id, lines: renderTable(m).length }).toEqual({
        id,
        lines: m.rows.length + 2,
      })
    }
  })
})
