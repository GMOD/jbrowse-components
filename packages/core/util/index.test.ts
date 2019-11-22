import { parseLocString, ParsedLocString } from './index'

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
      'hg19:chr1:1-200',
      { assemblyName: 'hg19', start: 1, end: 200, refName: 'chr1' },
    ],
    [
      'hg19:chr1:1..200',
      { assemblyName: 'hg19', start: 1, end: 200, refName: 'chr1' },
    ],
    [
      'hg19:chr1:1',
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
    ['chr2:1000-', { assemblyName: undefined, refName: 'chr2' }],
  ]
  cases.forEach(([input, output]) => {
    test(`${input}`, () => {
      expect(parseLocString(input)).toEqual(output)
    })
  })
})
