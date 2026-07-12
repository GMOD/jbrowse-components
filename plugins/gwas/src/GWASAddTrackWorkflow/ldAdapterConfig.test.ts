import { buildLdAdapterConfig } from './ldAdapterConfig.ts'

const uri = (s: string) => ({ uri: s, locationType: 'UriLocation' as const })

test('plain .ld URL → in-memory PlinkLDAdapter uri shorthand', () => {
  expect(buildLdAdapterConfig(uri('http://host/plink.ld'))).toEqual({
    type: 'PlinkLDAdapter',
    uri: 'http://host/plink.ld',
  })
})

test('.gz URL → tabix adapter uri shorthand (preProcessSnapshot derives .tbi)', () => {
  expect(buildLdAdapterConfig(uri('http://host/plink.ld.gz'))).toEqual({
    type: 'PlinkLDTabixAdapter',
    uri: 'http://host/plink.ld.gz',
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
