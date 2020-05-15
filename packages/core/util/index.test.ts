import { parseLocString, ParsedLocString, compareLocStrings } from './index'

describe('parseLocString', () => {
  const cases: [string, ParsedLocString][] = [
    [
      'chr1:1..200',
      { assemblyName: undefined, start: 1, end: 200, refName: 'chr1' },
    ],
    [
      'chr1:1-200',
      { assemblyName: undefined, start: 1, end: 200, refName: 'chr1' },
    ],
    [
      '{hg19}chr1:1-200',
      { assemblyName: 'hg19', start: 1, end: 200, refName: 'chr1' },
    ],
    [
      '{hg19}chr1:1..200',
      { assemblyName: 'hg19', start: 1, end: 200, refName: 'chr1' },
    ],
    [
      '{hg19}chr1:1',
      { assemblyName: 'hg19', start: 1, end: 1, refName: 'chr1' },
    ],
    ['chr1:1', { assemblyName: undefined, start: 1, end: 1, refName: 'chr1' }],
    [
      'chr1:-1',
      { assemblyName: undefined, start: -1, end: -1, refName: 'chr1' },
    ],
    [
      'chr1:-100..-1',
      { assemblyName: undefined, start: -100, end: -1, refName: 'chr1' },
    ],
    [
      'chr1:-100--1', // weird but valid
      { assemblyName: undefined, start: -100, end: -1, refName: 'chr1' },
    ],
    ['chr2:1000-', { assemblyName: undefined, refName: 'chr2', start: 1000 }],
  ]
  cases.forEach(([input, output]) => {
    test(`${input}`, () => {
      expect(
        parseLocString(
          input,
          refName => refName === 'chr1' || refName === 'chr2',
        ),
      ).toEqual(output)
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
  cases.forEach(([input1, input2, output]) => {
    test(`${input1} ${input2} = ${output}`, () => {
      expect(
        compareLocStrings(
          input1,
          input2,
          refName => refName === 'chr1' || refName === 'chr2',
        ),
      ).toEqual(output)
    })
  })
})
