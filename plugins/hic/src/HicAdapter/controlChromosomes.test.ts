import { controlChromosomes } from './controlChromosomes.ts'

const chr = (name: string, size: number, index = 0) => ({ name, size, index })

test('a control spelling chromosomes differently still pairs them', () => {
  expect(
    controlChromosomes(
      [chr('1', 100), chr('X', 50), chr('MT', 16)],
      [chr('chr1', 100), chr('chrX', 50), chr('chrM', 16)],
    ),
  ).toEqual(
    new Map([
      ['1', 'chr1'],
      ['X', 'chrX'],
      ['MT', 'chrM'],
    ]),
  )
})

test('a chromosome only the map holds is left unpaired', () => {
  expect(
    controlChromosomes([chr('1', 100), chr('Y', 60)], [chr('1', 100)]),
  ).toEqual(new Map([['1', '1']]))
})

// hg19 and hg38 share names; a ratio across them compares unrelated loci
test('a control on another build is refused', () => {
  expect(() =>
    controlChromosomes([chr('1', 249250621)], [chr('chr1', 248956422)]),
  ).toThrow(/another assembly: 1 is 249250621 bp/)
})

test('a control sharing no chromosome is refused', () => {
  expect(() => controlChromosomes([chr('1', 100)], [chr('2L', 100)])).toThrow(
    /shares no chromosome/,
  )
})
