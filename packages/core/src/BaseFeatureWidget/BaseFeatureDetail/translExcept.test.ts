import { parseTranslExcept } from './translExcept.ts'

test('a range on the minus strand', () => {
  expect(
    parseTranslExcept('(pos:complement(42808177..42808179),aa:Sec)'),
  ).toEqual([
    { ranges: [{ start: 42808177, end: 42808179 }], strand: -1, aa: 'Sec' },
  ])
})

test('a plain range', () => {
  expect(parseTranslExcept('(pos:3600..3602,aa:Sec)')).toEqual([
    { ranges: [{ start: 3600, end: 3602 }], strand: 1, aa: 'Sec' },
  ])
})

test('a single base and a partial codon', () => {
  expect(parseTranslExcept('(pos:1017,aa:TERM)')).toEqual([
    { ranges: [{ start: 1017, end: 1017 }], strand: 1, aa: 'TERM' },
  ])
  expect(
    parseTranslExcept('(pos:complement(42808177..42808178),aa:TERM)'),
  ).toEqual([
    { ranges: [{ start: 42808177, end: 42808178 }], strand: -1, aa: 'TERM' },
  ])
  expect(parseTranslExcept('(pos:<1..>2,aa:Met)')).toEqual([
    { ranges: [{ start: 1, end: 2 }], strand: 1, aa: 'Met' },
  ])
})

test('a codon split by an intron', () => {
  expect(
    parseTranslExcept('(pos:complement(join(100..101,200)),aa:Sec)'),
  ).toEqual([
    {
      ranges: [
        { start: 100, end: 101 },
        { start: 200, end: 200 },
      ],
      strand: -1,
      aa: 'Sec',
    },
  ])
})

test('several, as one string or as the array an unescaped comma splits them into', () => {
  const two = [
    { ranges: [{ start: 10, end: 12 }], strand: -1, aa: 'Sec' },
    { ranges: [{ start: 20, end: 22 }], strand: -1, aa: 'Sec' },
  ]
  expect(
    parseTranslExcept([
      '(pos:complement(10..12),aa:Sec)',
      '(pos:complement(20..22),aa:Sec)',
    ]),
  ).toEqual(two)
  expect(
    parseTranslExcept([
      '(pos:complement(10..12)',
      'aa:Sec)',
      '(pos:complement(20..22)',
      'aa:Sec)',
    ]),
  ).toEqual(two)
})

test('anything else is not guessed at', () => {
  expect(parseTranslExcept('selenocysteine at 3600')).toBeUndefined()
  expect(
    parseTranslExcept('(pos:NC_000005.10:3600..3602,aa:Sec)'),
  ).toBeUndefined()
  expect(parseTranslExcept('(pos:3602..3600,aa:Sec)')).toBeUndefined()
  expect(parseTranslExcept('(pos:3600..3602,aa:Sec) and more')).toBeUndefined()
  expect(parseTranslExcept('(pos:order(1..2,5),aa:Sec)')).toBeUndefined()
  expect(parseTranslExcept('')).toBeUndefined()
})
