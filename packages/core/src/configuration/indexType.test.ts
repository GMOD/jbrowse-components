import { readConfObject } from './readConfObject.ts'
import { tabixIndexSchema } from './tabixIndexFields.ts'
import { expandTabixShorthand, indexSnapshot } from './tabixShorthand.ts'

const indexTypeOf = (snap: Record<string, unknown>) =>
  readConfObject(tabixIndexSchema().create(snap), 'indexType')

describe('an index sub-schema infers its type from the file it names', () => {
  test.each([
    ['x.vcf.gz.tbi', 'TBI'],
    ['x.vcf.gz.csi', 'CSI'],
    ['x.vcf.gz.CSI', 'CSI'],
    // a presigned url carries a query string after the name
    ['https://h/x.vcf.gz.csi?X-Amz-Signature=ab', 'CSI'],
  ])('%s is a %s', (uri, indexType) => {
    expect(indexTypeOf({ location: { uri } })).toBe(indexType)
  })

  test('a local path is read the same way', () => {
    expect(indexTypeOf({ location: { localPath: '/d/x.vcf.gz.csi' } })).toBe(
      'CSI',
    )
  })

  test('an indexType the config states wins over the file name', () => {
    expect(
      indexTypeOf({ location: { uri: 'x.vcf.gz.csi' }, indexType: 'TBI' }),
    ).toBe('TBI')
  })

  // the synteny add-track form offers a ".tbi or .csi" picker and writes only
  // the location, which the dotplot guide's `jbrowse make-pif --csi` reader hits
  test('a bare location is all an add-track form has to write', () => {
    expect(indexTypeOf({ location: { uri: 'aln.pif.gz.csi' } })).toBe('CSI')
  })

  test('naming nothing keeps the sibling format', () => {
    expect(indexTypeOf({})).toBe('TBI')
  })
})

describe('the shorthand reads one index type out of three spellings', () => {
  const tabix = (snap: Record<string, unknown>) =>
    (
      expandTabixShorthand(
        { type: 'VcfTabixAdapter', uri: 'x.vcf.gz', ...snap },
        'vcfGzLocation',
      ) as { index: { indexType: string; location: { uri: string } } }
    ).index

  test('nothing said means the sibling .tbi', () => {
    expect(tabix({})).toMatchObject({
      indexType: 'TBI',
      location: { uri: 'x.vcf.gz.tbi' },
    })
  })

  test('csi: true names the .csi sibling', () => {
    expect(tabix({ csi: true })).toMatchObject({
      indexType: 'CSI',
      location: { uri: 'x.vcf.gz.csi' },
    })
  })

  // any `index` the config spelled out overwrote the derived one whole, so this
  // opened the .csi it names with the TBI parser
  test('an index named alongside csi: true keeps the CSI type', () => {
    expect(
      tabix({ csi: true, index: { location: { uri: 'else/x.vcf.gz.csi' } } }),
    ).toMatchObject({
      indexType: 'CSI',
      location: { uri: 'else/x.vcf.gz.csi' },
    })
  })

  // the mirror case, which lost the derived location to the slot's /path/to
  // placeholder
  test('index.indexType alone derives the matching sibling', () => {
    expect(tabix({ index: { indexType: 'CSI' } })).toMatchObject({
      indexType: 'CSI',
      location: { uri: 'x.vcf.gz.csi' },
    })
  })

  test('a .csi named without saying so is still a CSI', () => {
    expect(
      tabix({ index: { location: { uri: 'else/x.vcf.gz.csi' } } }),
    ).toMatchObject({
      indexType: 'CSI',
      location: { uri: 'else/x.vcf.gz.csi' },
    })
  })

  test('BAM spells its sibling format BAI', () => {
    expect(indexSnapshot({ uri: 'x.bam' }, 'BAI')).toMatchObject({
      indexType: 'BAI',
      location: { uri: 'x.bam.bai' },
    })
    expect(indexSnapshot({ uri: 'x.bam', csi: true }, 'BAI')).toMatchObject({
      indexType: 'CSI',
      location: { uri: 'x.bam.csi' },
    })
  })

  // the derived type is stated first and the written `index` spread over it, so a
  // value the enumeration does not have reaches MST rather than being read as the
  // sibling format
  test('an indexType the enumeration does not have is left to be refused', () => {
    expect(tabix({ index: { indexType: 'BOGUS' } })).toMatchObject({
      indexType: 'BOGUS',
    })
  })

  test('baseUri rides onto the derived index', () => {
    expect(tabix({ baseUri: 'file:///d/' })).toMatchObject({
      location: { uri: 'x.vcf.gz.tbi', baseUri: 'file:///d/' },
    })
  })
})
