import { accessNested, featureLabel, generateTitle, isEmpty } from './util.ts'

describe('isEmpty', () => {
  test('empty object', () => {
    expect(isEmpty({})).toBe(true)
  })
  test('non-empty object', () => {
    expect(isEmpty({ a: 1 })).toBe(false)
  })
})

describe('generateTitle', () => {
  test('a label and the type', () => {
    expect(generateTitle({ name: 'myName', type: 'gene' })).toBe(
      'myName · gene',
    )
    expect(generateTitle({ id: 'myId', type: 'gene' })).toBe('myId · gene')
  })

  test('a missing type or label leaves no literal "undefined"', () => {
    expect(generateTitle({ name: 'myName' })).toBe('myName')
    expect(generateTitle({ type: 'exon' })).toBe('exon')
    expect(generateTitle({})).toBe('')
  })

  test('HTML from a formatDetails callback is stripped', () => {
    expect(
      generateTitle({
        name: '<a href=https://google.com/?q=EDEN>EDEN</a>',
        id: 'EDEN',
        type: 'gene',
      }),
    ).toBe('EDEN · gene')
  })

  test('a long name is not cut', () => {
    const long = 'a'.repeat(40)
    expect(generateTitle({ name: long, type: 'gene' })).toBe(`${long} · gene`)
  })
})

describe('featureLabel', () => {
  test('GENCODE: the type-named name and accession', () => {
    expect(
      featureLabel({
        type: 'transcript',
        id: 'ENST00000413465.6',
        transcript_id: 'ENST00000413465.6',
        transcript_name: 'TP53-203',
        gene_name: 'TP53',
      }),
    ).toBe('TP53-203 · ENST00000413465.6')
    expect(
      featureLabel({
        type: 'gene',
        id: 'ENSG00000141510.19',
        gene_id: 'ENSG00000141510.19',
        gene_name: 'TP53',
      }),
    ).toBe('TP53 · ENSG00000141510.19')
  })

  test('an accession that contains the name is left out', () => {
    expect(
      featureLabel({
        type: 'mRNA',
        id: 'rna-NM_000518.5',
        name: 'NM_000518.5',
      }),
    ).toBe('NM_000518.5')
    expect(featureLabel({ type: 'mRNA', id: 'EDEN.1', name: 'EDEN.1' })).toBe(
      'EDEN.1',
    )
  })

  test('name before the type-named name, type-named id before id', () => {
    expect(
      featureLabel({
        type: 'mRNA',
        name: 'HBB-201',
        mRNA_name: 'other',
        mRNA_id: 'ENST00000335295',
        id: 'transcript:ENST00000335295',
      }),
    ).toBe('HBB-201 · ENST00000335295')
  })

  test('nothing to name it by', () => {
    expect(featureLabel({ type: 'exon' })).toBeUndefined()
    expect(featureLabel({ type: 'exon', name: '' })).toBeUndefined()
  })
})

describe('accessNested', () => {
  test('returns string value at path', () => {
    expect(accessNested(['a', 'b'], { a: { b: 'hello' } })).toBe('hello')
  })

  test('falls back to Description field on nested object', () => {
    expect(accessNested(['a'], { a: { Description: 'desc' } })).toBe('desc')
  })

  test('returns undefined for missing path', () => {
    expect(accessNested(['x', 'y'], {})).toBeUndefined()
  })

  test('a subfield does not inherit its parent field description', () => {
    expect(accessNested(['a', 'b'], { a: 'parent desc' })).toBeUndefined()
  })
})
