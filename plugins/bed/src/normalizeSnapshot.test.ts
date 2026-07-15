import { normalizeSnapshot as normalizeBedSnapshot } from './BedAdapter/configSchema.ts'
import { normalizeSnapshot as normalizeBedTabixSnapshot } from './BedTabixAdapter/configSchema.ts'
import { normalizeSnapshot as normalizeBedpeSnapshot } from './BedpeAdapter/configSchema.ts'

describe('BedAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to bedLocation', () => {
    expect(
      normalizeBedSnapshot({ type: 'BedAdapter', uri: 'my.bed' }),
    ).toMatchObject({
      bedLocation: { uri: 'my.bed' },
    })
  })

  test('passes through a fully-specified snapshot unchanged', () => {
    const snap = {
      type: 'BedAdapter',
      bedLocation: { uri: 'my.bed', locationType: 'UriLocation' },
    }
    expect(normalizeBedSnapshot(snap)).toBe(snap)
  })
})

describe('BedTabixAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to bedGzLocation + tbi index', () => {
    expect(
      normalizeBedTabixSnapshot({ type: 'BedTabixAdapter', uri: 'my.bed.gz' }),
    ).toMatchObject({
      bedGzLocation: { uri: 'my.bed.gz' },
      index: { indexType: 'TBI', location: { uri: 'my.bed.gz.tbi' } },
    })
  })

  test('expands uri shorthand with csi:true to csi index', () => {
    expect(
      normalizeBedTabixSnapshot({
        type: 'BedTabixAdapter',
        uri: 'my.bed.gz',
        csi: true,
      }),
    ).toMatchObject({
      bedGzLocation: { uri: 'my.bed.gz' },
      index: { indexType: 'CSI', location: { uri: 'my.bed.gz.csi' } },
    })
  })

  test('passes through a fully-specified snapshot unchanged', () => {
    const snap = {
      type: 'BedTabixAdapter',
      bedGzLocation: { uri: 'my.bed.gz', locationType: 'UriLocation' },
    }
    expect(normalizeBedTabixSnapshot(snap)).toBe(snap)
  })
})

describe('BedpeAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to bedpeLocation', () => {
    expect(
      normalizeBedpeSnapshot({ type: 'BedpeAdapter', uri: 'my.bedpe' }),
    ).toMatchObject({
      bedpeLocation: { uri: 'my.bedpe' },
    })
  })

  test('passes through a fully-specified snapshot unchanged', () => {
    const snap = {
      type: 'BedpeAdapter',
      bedpeLocation: { uri: 'my.bedpe', locationType: 'UriLocation' },
    }
    expect(normalizeBedpeSnapshot(snap)).toBe(snap)
  })
})
