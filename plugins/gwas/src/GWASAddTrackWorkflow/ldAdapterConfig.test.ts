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

test('.gz blob upload with no index → tabix adapter, index left undefined', () => {
  const ld = {
    blobId: 'b1',
    name: 'plink.ld.gz',
    locationType: 'BlobLocation' as const,
  }
  expect(buildLdAdapterConfig(ld)).toEqual({
    type: 'PlinkLDTabixAdapter',
    ldLocation: ld,
    index: { indexType: 'TBI', location: undefined },
  })
})
