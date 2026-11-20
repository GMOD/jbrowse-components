import fs from 'node:fs'

import { parsePedigree, withPedigree } from './pedigree.ts'

const g1k = fs.readFileSync(
  require.resolve('../VcfAdapter/test_data/g1k_pedigree_excerpt.txt'),
  'utf8',
)

const KHV_TRIO = ['HG02024', 'HG02025', 'HG02026']

function attributesOf(txt: string, names: readonly string[]) {
  return Object.fromEntries(parsePedigree(txt, names, 'ped.txt').attributes)
}

test("1000 Genomes' file is read by its header names", () => {
  expect(attributesOf(g1k, KHV_TRIO)).toEqual({
    HG02024: {
      family: 'VN049',
      father: 'HG02026',
      mother: 'HG02025',
      sex: 'female',
    },
    HG02025: { family: 'VN049', sex: 'female' },
    HG02026: { family: 'VN049', sex: 'male' },
  })
})

test('a headerless .fam gives the same attributes as the 1000 Genomes file', () => {
  const fam = [
    'VN049 HG02024 HG02026 HG02025 2 -9',
    'VN049 HG02025 0 0 2 -9',
    'VN049 HG02026 0 0 1 -9',
    'HG00096 HG00096 0 0 1 -9',
  ].join('\n')
  const names = [...KHV_TRIO, 'HG00096']

  expect(attributesOf(fam, names)).toEqual(attributesOf(g1k, names))
})

test('header names match in any case and order, and a leading # is read past', () => {
  const psam = ['#IID\tSEX\tPAT\tMAT\tFID', 'kid\t1\tdad\tmum\tfam1'].join('\n')

  expect(attributesOf(psam, ['kid', 'dad', 'mum'])).toEqual({
    kid: { family: 'fam1', father: 'dad', mother: 'mum', sex: 'male' },
  })
})

test('a .ped is read for its first six columns only', () => {
  expect(attributesOf('f1 kid dad mum 2 2 A G A A', ['kid'])).toEqual({
    kid: {
      family: 'f1',
      father: 'dad',
      mother: 'mum',
      sex: 'female',
      phenotype: 'affected',
    },
  })
})

test('a parent of 0 is no value', () => {
  expect(attributesOf('f1 kid 0 mum 1 1', ['kid', 'mum'])).toEqual({
    kid: { family: 'f1', mother: 'mum', sex: 'male', phenotype: 'unaffected' },
  })
})

test('a parent absent from the VCF is still named', () => {
  expect(attributesOf(g1k, ['HG02024'])).toEqual({
    HG02024: {
      family: 'VN049',
      father: 'HG02026',
      mother: 'HG02025',
      sex: 'female',
    },
  })
})

test('sex and phenotype codes', () => {
  const fam = [
    'f s1 0 0 1 -9',
    'f s2 0 0 2 0',
    'f s3 0 0 0 1',
    'f s4 0 0 -9 2',
    'f s5 0 0 3 12.5',
    'f s6 0 0 NA NA',
  ].join('\n')

  expect(attributesOf(fam, ['s1', 's2', 's3', 's4', 's5', 's6'])).toEqual({
    s1: { family: 'f', sex: 'male' },
    s2: { family: 'f', sex: 'female' },
    s3: { family: 'f', phenotype: 'unaffected' },
    s4: { family: 'f', phenotype: 'affected' },
    s5: { family: 'f', sex: 'other', phenotype: '12.5' },
    s6: { family: 'f' },
  })
})

test('a three-generation family links each child to its parents', () => {
  const fam = [
    '1463 NA12891 0 0 1 -9',
    '1463 NA12892 0 0 2 -9',
    '1463 NA12877 0 0 1 -9',
    '1463 NA12878 NA12891 NA12892 2 -9',
    '1463 NA12879 NA12877 NA12878 2 -9',
  ].join('\n')
  const attributes = attributesOf(fam, [
    'NA12891',
    'NA12892',
    'NA12877',
    'NA12878',
    'NA12879',
  ])

  expect(attributes.NA12878).toMatchObject({
    father: 'NA12891',
    mother: 'NA12892',
  })
  expect(attributes.NA12879).toMatchObject({
    father: 'NA12877',
    mother: 'NA12878',
  })
})

test('a selfed line names the same parent twice', () => {
  const { attributes, warnings } = parsePedigree(
    'line1 F2 F1 F1 0 -9',
    ['F1', 'F2'],
    'ped.txt',
  )

  expect(attributes.get('F2')).toEqual({
    family: 'line1',
    father: 'F1',
    mother: 'F1',
  })
  expect(warnings).toEqual([])
})

test('a sample naming itself as its parent loses that parent, with a warning', () => {
  const { attributes, warnings } = parsePedigree(
    'line1 F1 F1 0 0 -9',
    ['F1'],
    'ped.txt',
  )

  expect(attributes.get('F1')).toEqual({ family: 'line1' })
  expect(warnings).toEqual([
    expect.stringMatching(
      /1 samples name themselves as a parent.*ped\.txt.*F1/,
    ),
  ])
})

test("an IID naming no VCF sample is tried as PLINK's FID_IID", () => {
  expect(
    attributesOf('fam1 kid dad mum 1 -9', ['fam1_kid', 'fam1_dad', 'mum']),
  ).toEqual({
    fam1_kid: {
      family: 'fam1',
      father: 'fam1_dad',
      mother: 'mum',
      sex: 'male',
    },
  })
})

test('a pedigree matching no VCF sample warns and adds nothing', () => {
  const { attributes, warnings } = parsePedigree(
    g1k,
    ['1000GP_HG02024'],
    'ped.txt',
  )

  expect(attributes.size).toBe(0)
  expect(warnings).toEqual([
    expect.stringContaining(
      'No sample in the pedigree file ped.txt matches the VCF, so it adds nothing: it names "HG00096" where the VCF names "1000GP_HG02024"',
    ),
  ])
})

test("the samples table's column wins over the pedigree's", () => {
  const { attributes } = parsePedigree(g1k, KHV_TRIO, 'ped.txt')

  expect(
    withPedigree(
      [{ name: 'HG02024', sex: 'XX', population: 'KHV' }, { name: 'HG02026' }],
      attributes,
    ),
  ).toEqual([
    {
      name: 'HG02024',
      family: 'VN049',
      father: 'HG02026',
      mother: 'HG02025',
      sex: 'XX',
      population: 'KHV',
    },
    { name: 'HG02026', family: 'VN049', sex: 'male' },
  ])
})

test("the samples table's sex survives with no pedigree", () => {
  expect(withPedigree([{ name: 'HG02024', sex: 'XX' }], new Map())).toEqual([
    { name: 'HG02024', sex: 'XX' },
  ])
})

test('the pedigree never adds or removes a sample', () => {
  const { attributes } = parsePedigree(g1k, ['HG02024', 'absent'], 'ped.txt')

  expect(
    withPedigree([{ name: 'HG02024' }, { name: 'absent' }], attributes).map(
      source => source.name,
    ),
  ).toEqual(['HG02024', 'absent'])
})
