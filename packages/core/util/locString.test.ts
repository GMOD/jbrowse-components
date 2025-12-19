import { parseLocString, parseLocStringOneBased } from './locString'

import type { ParsedLocString } from './locString'

describe('parseLocString', () => {
  const cases: [string, ParsedLocString][] = [
    ['chr1:1..200', { start: 0, end: 200, refName: 'chr1' }],
    [
      'chr1:1,000,000..2,000,000',
      { start: 999999, end: 2000000, refName: 'chr1' },
    ],
    ['chr1:1-200', { start: 0, end: 200, refName: 'chr1' }],
    [
      '{hg19}chr1:1-200',
      {
        assemblyName: 'hg19',
        start: 0,
        end: 200,
        refName: 'chr1',
      },
    ],
    [
      '{hg19}chr1:1..200',
      {
        assemblyName: 'hg19',
        start: 0,
        end: 200,
        refName: 'chr1',
      },
    ],
    [
      '{hg19}chr1:1',
      {
        assemblyName: 'hg19',
        start: 0,
        end: 1,
        refName: 'chr1',
      },
    ],
    ['chr1:1', { start: 0, end: 1, refName: 'chr1' }],
    ['chr1:-1', { start: -2, end: -1, refName: 'chr1' }],
    ['chr1:-100..-1', { start: -101, end: -1, refName: 'chr1' }],
    [
      'chr1:-100--1', // weird but valid
      { start: -101, end: -1, refName: 'chr1' },
    ],
    ['chr2:1000-', { refName: 'chr2', start: 999 }],
    ['chr2:1,000-', { refName: 'chr2', start: 999 }],
    ['chr1', { refName: 'chr1' }],
    ['{hg19}chr1', { assemblyName: 'hg19', refName: 'chr1' }],
  ]

  // test unreversed
  for (const [input, output] of cases) {
    test(input, () => {
      expect(
        parseLocString(input, refName => ['chr1', 'chr2'].includes(refName)),
      ).toEqual({ ...output, reversed: false })
    })
  }

  // test reversed
  for (const [input, output] of cases) {
    test(`${input}[rev]`, () => {
      expect(
        parseLocString(`${input}[rev]`, refName =>
          ['chr1', 'chr2'].includes(refName),
        ),
      ).toEqual({ ...output, reversed: true })
    })
  }

  test('test empty assemblyName', () => {
    const location = '{}chr1:1..100'
    expect(() => {
      parseLocString(
        location,
        refName => refName === 'chr1' || refName === 'chr2',
      )
    }).toThrow(`no assembly name was provided in location "${location}"`)
  })

  test('test empty location string', () => {
    expect(() => {
      parseLocString('', refName => refName === 'chr1')
    }).toThrow('no location string provided, could not parse')
  })

  test('test unknown reference sequence', () => {
    expect(() => {
      parseLocString('chr3', refName => refName === 'chr1')
    }).toThrow('Unknown feature or sequence "chr3"')
  })
})

describe('parseLocString regex security tests', () => {
  const validRefName = (refName: string) => refName === 'chr1'

  test('handles strings with many nested braces efficiently', () => {
    const start = Date.now()
    expect(() => {
      parseLocString('{{{{{chr1', validRefName)
    }).toThrow()
    const duration = Date.now() - start
    expect(duration).toBeLessThan(100)
  })

  test('handles very long assembly names efficiently', () => {
    const longAssembly = 'a'.repeat(10000)
    const start = Date.now()
    const result = parseLocString(`{${longAssembly}}chr1:1..100`, validRefName)
    const duration = Date.now() - start
    expect(duration).toBeLessThan(100)
    expect(result.assemblyName).toBe(longAssembly)
  })

  test('handles malformed braces without catastrophic backtracking', () => {
    const testCases = [
      '{',
      '{{',
      '{{{',
      '{a{b{c',
      '{{{{{{{{{{',
      '{'.repeat(1000),
      '{a'.repeat(1000),
    ]

    for (const testCase of testCases) {
      const start = Date.now()
      expect(() => {
        parseLocString(testCase, validRefName)
      }).toThrow()
      const duration = Date.now() - start
      expect(duration).toBeLessThan(100)
    }
  })

  test('handles strings that would cause backtracking in old regex', () => {
    const problematicStrings = [
      '{aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      `{${'a'.repeat(100)}${'b'.repeat(100)}`,
      '{{{{{{{{{{aaaaaaaaaa',
    ]

    for (const str of problematicStrings) {
      const start = Date.now()
      expect(() => {
        parseLocString(str, validRefName)
      }).toThrow()
      const duration = Date.now() - start
      expect(duration).toBeLessThan(100)
    }
  })

  test('correctly parses assembly names with special characters', () => {
    const testCases = [
      ['{hg-19}chr1', 'hg-19'],
      ['{hg_19}chr1', 'hg_19'],
      ['{hg.19}chr1', 'hg.19'],
      ['{GRCh38.p13}chr1', 'GRCh38.p13'],
    ] as const

    for (const [input, expectedAssembly] of testCases) {
      const result = parseLocString(input, validRefName)
      expect(result.assemblyName).toBe(expectedAssembly)
      expect(result.refName).toBe('chr1')
    }
  })

  test('rejects assembly names containing closing braces', () => {
    expect(() => {
      parseLocString('{hg}19}chr1', validRefName)
    }).toThrow()
  })

  test('handles edge case with empty assembly name and location', () => {
    expect(() => {
      parseLocString('{}', validRefName)
    }).toThrow()
  })

  test('performance test with realistic inputs', () => {
    const inputs = [
      '{hg38}chr1:1000000..2000000',
      '{GRCh38.p13}chr22:15000000..16000000',
      'chr1:1..100',
      '{assembly_v2.1}scaffold_12345:500..1500',
    ]

    const start = Date.now()
    for (let i = 0; i < 1000; i++) {
      for (const input of inputs) {
        try {
          parseLocString(input, () => true)
        } catch {
          // ignore errors for this perf test
        }
      }
    }
    const duration = Date.now() - start
    expect(duration).toBeLessThan(1000)
  })
})

describe('parseLocStringOneBased', () => {
  test('returns 1-based coordinates', () => {
    const result = parseLocStringOneBased('chr1:1..100', refName =>
      ['chr1'].includes(refName),
    )
    expect(result.start).toBe(1)
    expect(result.end).toBe(100)
  })

  test('handles single position as 1-based', () => {
    const result = parseLocStringOneBased('chr1:50', refName =>
      ['chr1'].includes(refName),
    )
    expect(result.start).toBe(50)
    expect(result.end).toBe(50)
  })

  test('handles reversed flag', () => {
    const result = parseLocStringOneBased('chr1:1..100[rev]', refName =>
      ['chr1'].includes(refName),
    )
    expect(result.reversed).toBe(true)
    expect(result.start).toBe(1)
    expect(result.end).toBe(100)
  })
})

describe('parseLocString - edge cases and functional behavior changes', () => {
  const validRefName = (refName: string) => ['chr1', 'chr2'].includes(refName)

  test('assembly names with closing braces are now rejected (behavior change)', () => {
    // Old regex: /({(.+)})?(.+)/ would match {hg}19}chr1
    // New regex: /^(?:\{([^}]+)\})?(.+)/ rejects it
    expect(() => {
      parseLocString('{hg}19}chr1', validRefName)
    }).toThrow()
  })

  test('handles unclosed braces - should fail to match or throw', () => {
    expect(() => {
      parseLocString('{hg19chr1', validRefName)
    }).toThrow()
  })

  test('multiple opening braces - first brace starts assembly name', () => {
    // {{hg19}chr1 -> assembly name is "{hg19", location is "chr1"
    // This is technically valid syntax, though unusual
    const result = parseLocString('{{hg19}chr1', validRefName)
    expect(result.assemblyName).toBe('{hg19')
    expect(result.refName).toBe('chr1')
  })

  test('correctly handles nested-looking structures', () => {
    expect(() => {
      parseLocString('{hg{nested}}chr1', validRefName)
    }).toThrow()
  })

  test('empty braces at start', () => {
    expect(() => {
      parseLocString('{}chr1', validRefName)
    }).toThrow('no assembly name was provided in location "{}chr1"')
  })

  test('whitespace handling remains the same', () => {
    const result = parseLocString('chr1 :1..100', validRefName)
    expect(result.refName).toBe('chr1')
    expect(result.start).toBe(0)
    expect(result.end).toBe(100)
  })

  test('very long valid assembly names work correctly', () => {
    const longName = 'a'.repeat(1000)
    const result = parseLocString(`{${longName}}chr1`, validRefName)
    expect(result.assemblyName).toBe(longName)
    expect(result.refName).toBe('chr1')
  })

  test('assembly names with all allowed special chars', () => {
    const specialChars = ['-', '_', '.', '0', '9', 'A', 'z']
    for (const char of specialChars) {
      const assemblyName = `hg${char}19`
      const result = parseLocString(`{${assemblyName}}chr1`, validRefName)
      expect(result.assemblyName).toBe(assemblyName)
    }
  })

  test('location part can still contain anything after assembly', () => {
    // The (.+) at the end is still greedy, should match entire location
    const result = parseLocString('{hg19}chr1:1..100', validRefName)
    expect(result.assemblyName).toBe('hg19')
    expect(result.refName).toBe('chr1')
    expect(result.start).toBe(0)
    expect(result.end).toBe(100)
  })

  test('handles colons in refName as documented in SAM spec', () => {
    const validRefNameWithColon = (refName: string) =>
      ['chr1:test', 'chr1'].includes(refName)
    const result = parseLocString('chr1:test:100..200', validRefNameWithColon)
    expect(result.refName).toBe('chr1:test')
    expect(result.start).toBe(99)
    expect(result.end).toBe(200)
  })

  test('handles commas in refName', () => {
    const validRefNameWithComma = (refName: string) =>
      ['chr1,2', 'chr1'].includes(refName)
    const result = parseLocString('chr1,2:100..200', validRefNameWithComma)
    expect(result.refName).toBe('chr1,2')
    expect(result.start).toBe(99)
    expect(result.end).toBe(200)
  })

  test('anchored regex requires match from start', () => {
    // Old regex had no anchor, new one has ^
    // Both should work the same since we're using .exec() on the full string
    const result = parseLocString('chr1:1..100', validRefName)
    expect(result.refName).toBe('chr1')
  })
})
