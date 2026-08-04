import { normalizeSnapshot as normalizePlain } from './GtfAdapter/configSchema.ts'
import { normalizeSnapshot } from './GtfTabixAdapter/configSchema.ts'

describe('GtfTabixAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to gtfGzLocation + tbi index', () => {
    expect(
      normalizeSnapshot({ type: 'GtfTabixAdapter', uri: 'my.gtf.gz' }),
    ).toMatchObject({
      gtfGzLocation: { uri: 'my.gtf.gz' },
      index: { indexType: 'TBI', location: { uri: 'my.gtf.gz.tbi' } },
    })
  })

  test('expands uri shorthand with csi:true to csi index', () => {
    expect(
      normalizeSnapshot({
        type: 'GtfTabixAdapter',
        uri: 'my.gtf.gz',
        csi: true,
      }),
    ).toMatchObject({
      gtfGzLocation: { uri: 'my.gtf.gz' },
      index: { indexType: 'CSI', location: { uri: 'my.gtf.gz.csi' } },
    })
  })

  test('passes through a fully-specified snapshot unchanged', () => {
    const snap = {
      type: 'GtfTabixAdapter',
      gtfGzLocation: { uri: 'my.gtf.gz', locationType: 'UriLocation' },
    }
    expect(normalizeSnapshot(snap)).toBe(snap)
  })
})

describe('GtfAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to gtfLocation, carrying baseUri', () => {
    expect(
      normalizePlain({
        type: 'GtfAdapter',
        uri: 'my.gtf',
        baseUri: 'https://example.com/',
      }),
    ).toMatchObject({
      gtfLocation: { uri: 'my.gtf', baseUri: 'https://example.com/' },
    })
  })

  test('passes through a fully-specified snapshot unchanged', () => {
    const snap = {
      type: 'GtfAdapter',
      gtfLocation: { uri: 'my.gtf', locationType: 'UriLocation' },
    }
    expect(normalizePlain(snap)).toBe(snap)
  })
})
