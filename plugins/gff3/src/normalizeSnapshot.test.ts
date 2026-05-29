import { normalizeSnapshot } from './Gff3TabixAdapter/configSchema.ts'

describe('Gff3TabixAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to gffGzLocation + tbi index', () => {
    expect(
      normalizeSnapshot({ type: 'Gff3TabixAdapter', uri: 'my.gff.gz' }),
    ).toMatchObject({
      gffGzLocation: { uri: 'my.gff.gz' },
      index: { indexType: 'TBI', location: { uri: 'my.gff.gz.tbi' } },
    })
  })

  test('expands uri shorthand with csi:true to csi index', () => {
    expect(
      normalizeSnapshot({
        type: 'Gff3TabixAdapter',
        uri: 'my.gff.gz',
        csi: true,
      }),
    ).toMatchObject({
      gffGzLocation: { uri: 'my.gff.gz' },
      index: { indexType: 'CSI', location: { uri: 'my.gff.gz.csi' } },
    })
  })

  test('passes through a fully-specified snapshot unchanged', () => {
    const snap = {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri: 'my.gff.gz', locationType: 'UriLocation' },
    }
    expect(normalizeSnapshot(snap)).toBe(snap)
  })
})
