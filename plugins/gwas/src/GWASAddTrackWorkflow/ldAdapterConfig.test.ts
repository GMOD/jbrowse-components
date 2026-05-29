import { buildLdAdapterConfig } from './ldAdapterConfig.ts'

const uri = (s: string) => ({ uri: s, locationType: 'UriLocation' as const })

test('plain .ld file → in-memory PlinkLDAdapter', () => {
  const ld = uri('http://host/plink.ld')
  expect(buildLdAdapterConfig(ld)).toEqual({
    type: 'PlinkLDAdapter',
    ldLocation: ld,
  })
})

test('.gz file → tabix adapter with derived .tbi index for URLs', () => {
  const ld = uri('http://host/plink.ld.gz')
  expect(buildLdAdapterConfig(ld)).toEqual({
    type: 'PlinkLDTabixAdapter',
    ldLocation: ld,
    index: { indexType: 'TBI', location: uri('http://host/plink.ld.gz.tbi') },
  })
})

test('explicit index location wins over the derived one', () => {
  const ld = uri('http://host/plink.ld.gz')
  const idx = uri('http://host/custom.csi')
  expect(buildLdAdapterConfig(ld, idx)).toEqual({
    type: 'PlinkLDTabixAdapter',
    ldLocation: ld,
    index: { indexType: 'TBI', location: idx },
  })
})

test('.gz local file with no index → tabix adapter, index left undefined', () => {
  const ld = {
    localPath: '/data/plink.ld.gz',
    locationType: 'LocalPathLocation' as const,
  }
  expect(buildLdAdapterConfig(ld)).toEqual({
    type: 'PlinkLDTabixAdapter',
    ldLocation: ld,
    index: { indexType: 'TBI', location: undefined },
  })
})
