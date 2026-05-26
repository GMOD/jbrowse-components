import { normalizeSnapshot as normalizeVcfSnapshot } from './VcfAdapter/configSchema.ts'
import { normalizeSnapshot as normalizeVcfTabixSnapshot } from './VcfTabixAdapter/configSchema.ts'

describe('VcfAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to vcfLocation', () => {
    expect(normalizeVcfSnapshot({ type: 'VcfAdapter', uri: 'my.vcf' })).toMatchObject({
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
  test('expands uri shorthand to vcfGzLocation + index', () => {
    expect(
      normalizeVcfTabixSnapshot({ type: 'VcfTabixAdapter', uri: 'my.vcf.gz' }),
    ).toMatchObject({
      type: 'VcfTabixAdapter',
      vcfGzLocation: { uri: 'my.vcf.gz' },
      index: { location: { uri: 'my.vcf.gz.tbi' } },
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
