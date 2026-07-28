import { normalizeSnapshot } from './configSchema.ts'

describe('BamAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to bamLocation + bai index', () => {
    expect(
      normalizeSnapshot({ type: 'BamAdapter', uri: 'my.bam' }),
    ).toMatchObject({
      bamLocation: { uri: 'my.bam' },
      index: { indexType: 'BAI', location: { uri: 'my.bam.bai' } },
    })
  })

  test('expands uri shorthand with csi:true to csi index', () => {
    expect(
      normalizeSnapshot({ type: 'BamAdapter', uri: 'my.bam', csi: true }),
    ).toMatchObject({
      bamLocation: { uri: 'my.bam' },
      index: { indexType: 'CSI', location: { uri: 'my.bam.csi' } },
    })
  })

  test('passes through a fully-specified snapshot unchanged', () => {
    const snap = {
      type: 'BamAdapter',
      bamLocation: { uri: 'my.bam', locationType: 'UriLocation' },
    }
    expect(normalizeSnapshot(snap)).toBe(snap)
  })
})
