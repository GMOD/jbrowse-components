import { normalizeSnapshot as normalizeLdTabixSnapshot } from './PlinkLDAdapter/configSchemaTabix.ts'
import { normalizeSnapshot as normalizeVcfSnapshot } from './VcfAdapter/configSchema.ts'
import { normalizeSnapshot as normalizeVcfTabixSnapshot } from './VcfTabixAdapter/configSchema.ts'

describe('VcfAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to vcfLocation', () => {
    expect(
      normalizeVcfSnapshot({ type: 'VcfAdapter', uri: 'my.vcf' }),
    ).toMatchObject({
      type: 'VcfAdapter',
      vcfLocation: { uri: 'my.vcf' },
    })
  })

  test('passes through a fully-specified snapshot unchanged', () => {
    const snap = {
      type: 'VcfAdapter',
      vcfLocation: { uri: 'my.vcf', locationType: 'UriLocation' },
    }
    expect(normalizeVcfSnapshot(snap)).toBe(snap)
  })
})

describe('VcfTabixAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to vcfGzLocation + tbi index', () => {
    expect(
      normalizeVcfTabixSnapshot({ type: 'VcfTabixAdapter', uri: 'my.vcf.gz' }),
    ).toMatchObject({
      type: 'VcfTabixAdapter',
      vcfGzLocation: { uri: 'my.vcf.gz' },
      index: { indexType: 'TBI', location: { uri: 'my.vcf.gz.tbi' } },
    })
  })

  test('expands uri shorthand with csi:true to csi index', () => {
    expect(
      normalizeVcfTabixSnapshot({
        type: 'VcfTabixAdapter',
        uri: 'my.vcf.gz',
        csi: true,
      }),
    ).toMatchObject({
      vcfGzLocation: { uri: 'my.vcf.gz' },
      index: { indexType: 'CSI', location: { uri: 'my.vcf.gz.csi' } },
    })
  })

  test('passes through a fully-specified snapshot unchanged', () => {
    const snap = {
      type: 'VcfTabixAdapter',
      vcfGzLocation: { uri: 'my.vcf.gz', locationType: 'UriLocation' },
    }
    expect(normalizeVcfTabixSnapshot(snap)).toBe(snap)
  })
})

describe('PlinkLDTabixAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to ldLocation + tbi index', () => {
    expect(
      normalizeLdTabixSnapshot({
        type: 'PlinkLDTabixAdapter',
        uri: 'my.ld.gz',
      }),
    ).toMatchObject({
      ldLocation: { uri: 'my.ld.gz' },
      index: { indexType: 'TBI', location: { uri: 'my.ld.gz.tbi' } },
    })
  })

  // this adapter wrote its own expansion and left `csi` out of it, so the flag
  // every other tabix adapter honors resolved a .tbi here and said nothing
  test('expands uri shorthand with csi:true to csi index', () => {
    expect(
      normalizeLdTabixSnapshot({
        type: 'PlinkLDTabixAdapter',
        uri: 'my.ld.gz',
        csi: true,
      }),
    ).toMatchObject({
      ldLocation: { uri: 'my.ld.gz' },
      index: { indexType: 'CSI', location: { uri: 'my.ld.gz.csi' } },
    })
  })
})
