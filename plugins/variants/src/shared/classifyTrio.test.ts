import {
  MAX_CLASSIFIED_PLOIDY,
  classifyTrio,
  mostSevereTrioClass,
} from './classifyTrio.ts'

import type {
  PedigreeSex,
  TransmissionEntry,
  TrioClass,
} from './classifyTrio.ts'

interface Row {
  name: string
  child: string
  father: string | undefined
  mother: string | undefined
  sex?: PedigreeSex
  rule?: TransmissionEntry[]
  expected: TrioClass | undefined
}

const hg38X: TransmissionEntry[] = [{ sex: 'male', from: 'mother' }]
const hg38Y: TransmissionEntry[] = [{ sex: 'male', from: 'father' }]
const hg38M: TransmissionEntry[] = [{ from: 'either' }]
const haplodiploid: TransmissionEntry[] = [{ sex: 'male', from: 'mother' }]
const zwZ: TransmissionEntry[] = [{ sex: 'female', from: 'father' }]
const zwW: TransmissionEntry[] = [{ sex: 'female', from: 'mother' }]
const xoX: TransmissionEntry[] = [{ sex: 'male', from: 'mother' }]
const yeastM: TransmissionEntry[] = [{ from: 'either' }]

function run({ child, father, mother, sex, rule = [] }: Row) {
  return classifyTrio(child, father, mother, { sex, rule })
}

describe('autosomal truth table', () => {
  it.each<Row>([
    {
      name: '0/1 from 0/0 x 0/0',
      child: '0/1',
      father: '0/0',
      mother: '0/0',
      expected: 'notInParents',
    },
    {
      name: '1/1 from 0/0 x 0/0',
      child: '1/1',
      father: '0/0',
      mother: '0/0',
      expected: 'notInParents',
    },
    {
      name: './1 from 0/0 x 0/0',
      child: './1',
      father: '0/0',
      mother: '0/0',
      expected: 'notInParents',
    },
    {
      name: '0/2 from 1/1 x 0/0',
      child: '0/2',
      father: '1/1',
      mother: '0/0',
      expected: 'notInParents',
    },
    {
      name: '1/1 from 0/1 x 0/0',
      child: '1/1',
      father: '0/1',
      mother: '0/0',
      expected: 'inconsistent',
    },
    {
      name: '1/2 from 1/2 x 0/0 needs one-to-one assignment',
      child: '1/2',
      father: '1/2',
      mother: '0/0',
      expected: 'inconsistent',
    },
    {
      name: '0/0 from 1/1 x ./.',
      child: '0/0',
      father: '1/1',
      mother: './.',
      expected: 'inconsistent',
    },
    {
      name: '1/1 from ./0 x 0/0',
      child: '1/1',
      father: './0',
      mother: '0/0',
      expected: 'inconsistent',
    },
    {
      name: '1/1 from 0/1 x 0/1',
      child: '1/1',
      father: '0/1',
      mother: '0/1',
      expected: 'consistent',
    },
    {
      name: 'phased 1|0 from 0|1 x 0|0, phase ignored',
      child: '1|0',
      father: '0|1',
      mother: '0|0',
      expected: 'consistent',
    },
    {
      name: '1/2 from 1/1 x 0/2',
      child: '1/2',
      father: '1/1',
      mother: '0/2',
      expected: 'consistent',
    },
    {
      name: './1 from 0/1 x 0/0',
      child: './1',
      father: '0/1',
      mother: '0/0',
      expected: undefined,
    },
  ])('$name is $expected', row => {
    expect(run(row)).toBe(row.expected)
  })
})

describe("under hg38's entries", () => {
  it.each<Row>([
    {
      name: 'male X 1, father 0, mother 0/1',
      child: '1',
      father: '0',
      mother: '0/1',
      sex: 'male',
      rule: hg38X,
      expected: 'consistent',
    },
    {
      name: 'male X 1, father 1, mother 0/0',
      child: '1',
      father: '1',
      mother: '0/0',
      sex: 'male',
      rule: hg38X,
      expected: 'inconsistent',
    },
    {
      name: 'male X diploid-coded 1/1, father 0/0, mother 0/1',
      child: '1/1',
      father: '0/0',
      mother: '0/1',
      sex: 'male',
      rule: hg38X,
      expected: 'consistent',
    },
    {
      name: 'male X het 0/1 in a PAR, father 0/1, mother 0/0, takes the autosomal rule',
      child: '0/1',
      father: '0/1',
      mother: '0/0',
      sex: 'male',
      rule: hg38X,
      expected: 'consistent',
    },
    {
      name: 'male X PAR homozygote 1/1, father 1/1, mother 0/0',
      child: '1/1',
      father: '1/1',
      mother: '0/0',
      sex: 'male',
      rule: hg38X,
      expected: 'inconsistent',
    },
    {
      name: 'X with sex missing, 1/1, father 0/0, mother 0/1',
      child: '1/1',
      father: '0/0',
      mother: '0/1',
      rule: hg38X,
      expected: undefined,
    },
    {
      name: 'X with sex missing, het 0/1 whose readings agree',
      child: '0/1',
      father: '0/1',
      mother: '0/0',
      rule: hg38X,
      expected: 'consistent',
    },
    {
      name: "son's Y 1, father 0, mother .",
      child: '1',
      father: '0',
      mother: '.',
      sex: 'male',
      rule: hg38Y,
      expected: 'notInParents',
    },
    {
      name: "son's Y 1, father 1, mother .",
      child: '1',
      father: '1',
      mother: '.',
      sex: 'male',
      rule: hg38Y,
      expected: 'consistent',
    },
    {
      name: 'father-son duo on X with no entries, 1, father 0 (Union)',
      child: '1',
      father: '0',
      mother: undefined,
      sex: 'male',
      rule: [],
      expected: undefined,
    },
    {
      name: 'father-son duo on X, 1, father 0, mother unknown',
      child: '1',
      father: '0',
      mother: undefined,
      sex: 'male',
      rule: hg38X,
      expected: undefined,
    },
    {
      name: 'mito 0/1, mother 0, father 1 (either)',
      child: '0/1',
      father: '1',
      mother: '0',
      rule: hg38M,
      expected: 'consistent',
    },
    {
      name: 'mito duo 1, mother 0, father unknown (either)',
      child: '1',
      father: undefined,
      mother: '0',
      rule: hg38M,
      expected: undefined,
    },
  ])('$name is $expected', row => {
    expect(run(row)).toBe(row.expected)
  })
})

describe('across taxa', () => {
  it.each<Row>([
    {
      name: 'autotetraploid 2 + 2',
      child: '0/0/1/1',
      father: '0/0/0/1',
      mother: '0/0/1/1',
      expected: 'consistent',
    },
    {
      name: 'autotetraploid double reduction gives 1/1 from 0/0/0/1',
      child: '1/1/0/0',
      father: '0/0/0/1',
      mother: '0/0/0/0',
      expected: 'consistent',
    },
    {
      name: 'autotetraploid three alt from a simplex and a nulliplex parent',
      child: '1/1/1/0',
      father: '0/0/0/1',
      mother: '0/0/0/0',
      expected: 'inconsistent',
    },
    {
      name: 'autotetraploid allele in neither parent',
      child: '0/0/0/2',
      father: '0/0/0/1',
      mother: '0/0/1/1',
      expected: 'notInParents',
    },
    {
      name: '2x by 4x triploid, 1 + 2',
      child: '0/1/1',
      father: '0/1',
      mother: '0/0/1/1',
      expected: 'consistent',
    },
    {
      name: '2x by 4x triploid with the diploid parent unable to give 1',
      child: '1/1/1',
      father: '0/0',
      mother: '1/1/1/1',
      expected: 'inconsistent',
    },
    {
      name: 'trisomic child takes the irregular split',
      child: '0/0/1',
      father: '0/0',
      mother: '0/1',
      expected: 'consistent',
    },
    {
      name: 'trisomic child with no split is never inconsistent',
      child: '1/1/1',
      father: '0/0',
      mother: '0/1',
      expected: undefined,
    },
    {
      name: 'haplodiploid son from his mother',
      child: '1',
      father: '0',
      mother: '0/1',
      sex: 'male',
      rule: haplodiploid,
      expected: 'consistent',
    },
    {
      name: 'haplodiploid son with an allele only his father carries',
      child: '1',
      father: '1',
      mother: '0/0',
      sex: 'male',
      rule: haplodiploid,
      expected: 'inconsistent',
    },
    {
      name: 'haplodiploid daughter, haploid father gives 1',
      child: '0/1',
      father: '1',
      mother: '0/0',
      sex: 'female',
      rule: haplodiploid,
      expected: 'consistent',
    },
    {
      name: 'haplodiploid daughter 1/1 from father 1 and mother 0/0',
      child: '1/1',
      father: '1',
      mother: '0/0',
      sex: 'female',
      rule: haplodiploid,
      expected: 'inconsistent',
    },
    {
      name: 'selfed line 1/1 from 0/1',
      child: '1/1',
      father: '0/1',
      mother: '0/1',
      expected: 'consistent',
    },
    {
      name: 'selfed line 0/2 from 0/1',
      child: '0/2',
      father: '0/1',
      mother: '0/1',
      expected: 'notInParents',
    },
    {
      name: 'duo with opposite homozygotes, mother known',
      child: '1/1',
      father: undefined,
      mother: '0/0',
      expected: 'inconsistent',
    },
    {
      name: 'duo with opposite homozygotes, father known',
      child: '0/0',
      father: '1/1',
      mother: undefined,
      expected: 'inconsistent',
    },
    {
      name: 'duo sharing an allele',
      child: '0/1',
      father: undefined,
      mother: '0/0',
      expected: 'consistent',
    },
    {
      name: 'ZW female Z from her father',
      child: '1',
      father: '0/1',
      mother: '0',
      sex: 'female',
      rule: zwZ,
      expected: 'consistent',
    },
    {
      name: 'ZW female Z carried only by her mother',
      child: '1',
      father: '0/0',
      mother: '1',
      sex: 'female',
      rule: zwZ,
      expected: 'inconsistent',
    },
    {
      name: 'ZW female W from her mother',
      child: '1',
      father: '.',
      mother: '1',
      sex: 'female',
      rule: zwW,
      expected: 'consistent',
    },
    {
      name: 'ZW female W in neither parent',
      child: '1',
      father: '.',
      mother: '0',
      sex: 'female',
      rule: zwW,
      expected: 'notInParents',
    },
    {
      name: 'XO male X from his mother',
      child: '1',
      father: '0',
      mother: '1/1',
      sex: 'male',
      rule: xoX,
      expected: 'consistent',
    },
    {
      name: 'XO male X carried only by his father',
      child: '1',
      father: '1',
      mother: '0/0',
      sex: 'male',
      rule: xoX,
      expected: 'inconsistent',
    },
    {
      name: 'C. elegans hermaphrodite X takes the autosomal rule',
      child: '1/1',
      father: '1',
      mother: '0/1',
      sex: 'other',
      rule: xoX,
      expected: 'consistent',
    },
    {
      name: 'C. elegans hermaphrodite X 1/1 with father 0',
      child: '1/1',
      father: '0',
      mother: '0/1',
      sex: 'other',
      rule: xoX,
      expected: 'inconsistent',
    },
    {
      name: 'Bombyx Z as 1, diploid-coded female 1/1 from her father',
      child: '1/1',
      father: '0/1',
      mother: '0/0',
      sex: 'female',
      rule: zwZ,
      expected: 'consistent',
    },
    {
      name: 'Bombyx Z as 1, female 1/1 carried only by her mother',
      child: '1/1',
      father: '0/0',
      mother: '1/1',
      sex: 'female',
      rule: zwZ,
      expected: 'inconsistent',
    },
    {
      name: 'yeast chrM either, from the father',
      child: '1',
      father: '1',
      mother: '0',
      rule: yeastM,
      expected: 'consistent',
    },
    {
      name: 'yeast chrM either, in neither parent',
      child: '1',
      father: '0',
      mother: '0',
      rule: yeastM,
      expected: 'notInParents',
    },
    {
      name: 'yeast chrM either is never inconsistent',
      child: '1',
      father: '0',
      mother: './.',
      rule: yeastM,
      expected: undefined,
    },
    {
      name: 'sacCer3 chrX with no entry takes the autosomal rule',
      child: '1/1',
      father: '0/1',
      mother: '0/0',
      rule: [],
      expected: 'inconsistent',
    },
    {
      name: 'default [] reads a diploid-coded male X falsely inconsistent',
      child: '1/1',
      father: '0',
      mother: '0/1',
      sex: 'male',
      rule: [],
      expected: 'inconsistent',
    },
  ])('$name is $expected', row => {
    expect(run(row)).toBe(row.expected)
  })
})

describe('the ploidy cap', () => {
  const calls = (ploidy: number, allele: string) =>
    Array.from({ length: ploidy }, () => allele).join('/')

  it('classifies a child at the cap', () => {
    expect(
      classifyTrio(
        calls(MAX_CLASSIFIED_PLOIDY, '1'),
        calls(MAX_CLASSIFIED_PLOIDY, '0'),
        calls(MAX_CLASSIFIED_PLOIDY, '0'),
        { sex: undefined, rule: [] },
      ),
    ).toBe('notInParents')
  })

  it('leaves a child past the cap unclassified', () => {
    expect(
      classifyTrio(
        calls(MAX_CLASSIFIED_PLOIDY + 1, '1'),
        calls(MAX_CLASSIFIED_PLOIDY + 1, '0'),
        calls(MAX_CLASSIFIED_PLOIDY + 1, '0'),
        { sex: undefined, rule: [] },
      ),
    ).toBeUndefined()
  })
})

describe('mostSevereTrioClass', () => {
  it.each<{
    name: string
    classes: (TrioClass | undefined)[]
    expected: TrioClass | undefined
  }>([
    { name: 'no trios', classes: [], expected: undefined },
    {
      name: 'none classifiable',
      classes: [undefined, undefined],
      expected: undefined,
    },
    {
      name: 'consistent with an unclassifiable trio',
      classes: [undefined, 'consistent'],
      expected: 'consistent',
    },
    {
      name: 'inconsistent over consistent',
      classes: ['consistent', 'inconsistent'],
      expected: 'inconsistent',
    },
    {
      name: 'notInParents over inconsistent',
      classes: ['inconsistent', 'notInParents', 'consistent'],
      expected: 'notInParents',
    },
  ])('$name is $expected', ({ classes, expected }) => {
    expect(mostSevereTrioClass(classes)).toBe(expected)
  })
})
