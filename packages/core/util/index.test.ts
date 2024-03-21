import {
  assembleLocString,
  parseLocString,
  ParsedLocString,
  compareLocStrings,
  stringify,
} from './index'

describe('parseLocString', () => {
  const cases: [string, ParsedLocString][] = [
    ['chr1:1..200', { end: 200, refName: 'chr1', start: 0 }],
    [
      'chr1:1,000,000..2,000,000',
      { end: 2000000, refName: 'chr1', start: 999999 },
    ],
    ['chr1:1-200', { end: 200, refName: 'chr1', start: 0 }],
    [
      '{hg19}chr1:1-200',
      {
        assemblyName: 'hg19',
        end: 200,
        refName: 'chr1',
        start: 0,
      },
    ],
    [
      '{hg19}chr1:1..200',
      {
        assemblyName: 'hg19',
        end: 200,
        refName: 'chr1',
        start: 0,
      },
    ],
    [
      '{hg19}chr1:1',
      {
        assemblyName: 'hg19',
        end: 1,
        refName: 'chr1',
        start: 0,
      },
    ],
    ['chr1:1', { end: 1, refName: 'chr1', start: 0 }],
    ['chr1:-1', { end: -1, refName: 'chr1', start: -2 }],
    ['chr1:-100..-1', { end: -1, refName: 'chr1', start: -101 }],
    [
      'chr1:-100--1', // weird but valid
      { end: -1, refName: 'chr1', start: -101 },
    ],
    ['chr2:1000-', { refName: 'chr2', start: 999 }],
    ['chr2:1,000-', { refName: 'chr2', start: 999 }],
    ['chr1', { refName: 'chr1' }],
    ['{hg19}chr1', { assemblyName: 'hg19', refName: 'chr1' }],
  ]

  // test unreversed
  for (const [input, output] of cases) {
    test(`${input}`, () => {
      expect(
        parseLocString(input, refName => ['chr1', 'chr2'].includes(refName)),
      ).toEqual({ ...output, reversed: false })
    })
  }

  // test reversed
  for (const [input, output] of cases) {
    test(`${input}`, () => {
      expect(
        parseLocString(input + '[rev]', refName =>
          ['chr1', 'chr2'].includes(refName),
        ),
      ).toEqual({ ...output, reversed: true })
    })
  }
})

describe('assembleLocString', () => {
  const cases: [ParsedLocString, string][] = [
    [{ refName: 'chr1' }, 'chr1'],
    [{ refName: 'chr1', start: 0 }, 'chr1:1..'],
    [{ end: 1, refName: 'chr1', start: 0 }, 'chr1:1'],
    [{ end: 100, refName: 'chr1', start: 0 }, 'chr1:1..100'],
    [{ end: 200, refName: 'chr1', start: 0 }, 'chr1:1..200'],
    [
      { end: 2000000, refName: 'chr1', start: 1000000 },
      'chr1:1,000,001..2,000,000',
    ],
    [
      { assemblyName: 'hg19', end: 100, refName: 'chr1', start: 0 },
      '{hg19}chr1:1..100',
    ],
    [{ end: -1, refName: 'chr1', start: -2 }, 'chr1:-1'],
    [{ end: -1, refName: 'chr1', start: -100 }, 'chr1:-99..-1'],
  ]
  for (const [input, output] of cases) {
    test(`assemble ${output}`, () => {
      expect(assembleLocString(input)).toEqual(output)
    })
    test(`assemble and parse ${output}`, () => {
      expect(
        parseLocString(
          assembleLocString(input),
          refName => refName === 'chr1' || refName === 'chr2',
        ),
      ).toEqual({ ...input, reversed: false })
    })
  }

  // Special case since undefined `start` will result in `start` being assumed
  // to be `0`
  const location = { end: 100, refName: 'chr1' }
  test("assemble 'chr1:1..100'", () => {
    expect(assembleLocString(location)).toEqual('chr1:1..100')
  })

  test('test empty assemblyName', () => {
    const location = '{}chr1:1..100'
    expect(() => {
      parseLocString(
        location,
        refName => refName === 'chr1' || refName === 'chr2',
      )
    }).toThrow(`no assembly name was provided in location "${location}"`)
  })

  test("assemble and parse 'chr1:1..100'", () => {
    expect(
      parseLocString(
        assembleLocString(location),
        refName => refName === 'chr1' || refName === 'chr2',
      ),
    ).toEqual({
      ...location,
      assemblyName: undefined,
      reversed: false,
      start: 0,
    })
  })
})

describe('compareLocStrings', () => {
  const cases: [string, string, number][] = [
    ['chr1:1..200', 'chr1:1-200', 0],
    ['chr1:1-200', '{hg19}chr1:1-200', -1],
    ['{hg19}chr1:1-200', 'chr1:1-200', 1],
    ['{hg19}chr1:1-200', '{hg19}chr1:2-200', -1],
  ]
  for (const [input1, input2, output] of cases) {
    test(`${input1} ${input2} = ${output}`, () => {
      expect(
        compareLocStrings(
          input1,
          input2,
          refName => refName === 'chr1' || refName === 'chr2',
        ),
      ).toEqual(output)
    })
  }
})

describe('test stringify', () => {
  const testStringify = {
    assemblyName: 'volvox',
    coord: 5001,
    end: 20000,
    index: 0,
    offset: 0,
    oob: false,
    refName: 'ctgA',
    reversed: false,
    start: 5000,
  }
  test('stringify refName: bp', () => {
    expect(
      stringify({
        coord: testStringify.offset,
        refName: testStringify.refName,
      }),
    ).toBe('ctgA:0')
  })
})
