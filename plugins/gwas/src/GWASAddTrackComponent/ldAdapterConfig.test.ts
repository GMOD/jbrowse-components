import { buildLdAdapterConfig } from './ldAdapterConfig.ts'

const uri = (s: string) => ({ uri: s, locationType: 'UriLocation' as const })

const typeOf = (loc: ReturnType<typeof uri>) => buildLdAdapterConfig(loc).type

test('plain .ld URL → in-memory PlinkLDAdapter', () => {
  const ld = uri('http://host/plink.ld')
  expect(buildLdAdapterConfig(ld)).toEqual({
    type: 'PlinkLDAdapter',
    ldLocation: ld,
  })
})

test('.gz URL → tabix adapter, deriving the sibling .tbi', () => {
  const ld = uri('http://host/plink.ld.gz')
  expect(buildLdAdapterConfig(ld)).toEqual({
    type: 'PlinkLDTabixAdapter',
    ldLocation: ld,
    index: { indexType: 'TBI', location: uri('http://host/plink.ld.gz.tbi') },
  })
})

// The `uri` shorthand keeps only `uri` and `baseUri`
test("a URL's internet account stays on the location", () => {
  const ld = { ...uri('http://host/plink.ld'), internetAccountId: 'acct' }
  expect(buildLdAdapterConfig(ld)).toEqual({
    type: 'PlinkLDAdapter',
    ldLocation: ld,
  })
})

// `.bgz` is the same file under the name htslib's own tools give it, and this
// form's own adapter guess matches `\.ld\.b?gz$` — sniffing only `.gz` sent it
// to the in-memory adapter, which cannot read a bgzipped file at all
test('.bgz URL → tabix adapter, same as .gz', () => {
  expect(typeOf(uri('http://host/plink.ld.bgz'))).toBe('PlinkLDTabixAdapter')
})

test('a presigned .gz URL → tabix adapter, its query string ignored', () => {
  expect(
    typeOf(
      uri('https://bucket.s3.amazonaws.com/plink.ld.gz?X-Amz-Signature=ab'),
    ),
  ).toBe('PlinkLDTabixAdapter')
})

test('explicit .csi index location wins and is typed CSI', () => {
  const ld = uri('http://host/plink.ld.gz')
  const idx = uri('http://host/custom.csi')
  expect(buildLdAdapterConfig(ld, idx)).toEqual({
    type: 'PlinkLDTabixAdapter',
    ldLocation: ld,
    index: { indexType: 'CSI', location: idx },
  })
})

test('explicit .tbi index location wins and is typed TBI', () => {
  const ld = uri('http://host/plink.ld.gz')
  const idx = uri('http://host/custom.tbi')
  expect(buildLdAdapterConfig(ld, idx)).toEqual({
    type: 'PlinkLDTabixAdapter',
    ldLocation: ld,
    index: { indexType: 'TBI', location: idx },
  })
})

test('.gz local path with no index → tabix adapter, derives sibling .tbi', () => {
  const ld = {
    localPath: '/data/plink.ld.gz',
    locationType: 'LocalPathLocation' as const,
  }
  expect(buildLdAdapterConfig(ld)).toEqual({
    type: 'PlinkLDTabixAdapter',
    ldLocation: ld,
    index: {
      indexType: 'TBI',
      location: {
        localPath: '/data/plink.ld.gz.tbi',
        locationType: 'LocalPathLocation',
      },
    },
  })
})

test('a name outside the format table still reads as an LD table', () => {
  expect(typeOf(uri('http://host/sle_r2.txt.gz'))).toBe('PlinkLDTabixAdapter')
  expect(typeOf(uri('http://host/sle_r2.txt'))).toBe('PlinkLDAdapter')
})

test("a derived index keeps the file's internet account", () => {
  const ld = { ...uri('http://host/plink.ld.gz'), internetAccountId: 'acct' }
  expect(buildLdAdapterConfig(ld)).toMatchObject({
    index: { location: { internetAccountId: 'acct' } },
  })
})
