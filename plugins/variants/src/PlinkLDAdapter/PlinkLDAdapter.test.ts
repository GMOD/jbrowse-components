import PlinkLDAdapter from './PlinkLDAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter(f: string) {
  return new PlinkLDAdapter(
    configSchema.create({
      ldLocation: {
        localPath: require.resolve(f),
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

test('reads PLINK .ld records from a local file', async () => {
  const adapter = makeAdapter('./test_data/example.ld')
  const records = await adapter.getLDRecords({
    refName: '1',
    start: 0,
    end: 5000,
  })
  expect(records).toHaveLength(4)
  const partner = records.find(r => r.snpB === 'rsB')!
  expect(partner.snpA).toBe('rsLEAD')
  expect(partner.bpB).toBe(1200)
  expect(partner.r2).toBeCloseTo(0.82)
})

test('exposes refNames from the file', async () => {
  const adapter = makeAdapter('./test_data/example.ld')
  expect(await adapter.getRefNames()).toEqual(['1'])
})

// dprimeIdx < 0 is what makes the display disable the D' metric and downgrade
// a 'dprime' request to r² — an R2-only file must report no D' column.
test('getHeader reports no D column for an R2-only file', async () => {
  const adapter = makeAdapter('./test_data/example.ld')
  expect((await adapter.getHeader()).dprimeIdx).toBe(-1)
})

// getLDRecords keeps every pair whose A-side is in the region; the triangle
// display needs both endpoints in view, so getLDRecordsInRegion drops pairs
// reaching outside it (rsC at 1500, rsD at 2000).
test('getLDRecordsInRegion requires both SNPs in the region', async () => {
  const adapter = makeAdapter('./test_data/example.ld')
  const query = { refName: '1', start: 0, end: 1300 }
  expect(await adapter.getLDRecords(query)).toHaveLength(4)
  const inRegion = await adapter.getLDRecordsInRegion(query)
  expect(inRegion.map(r => r.snpB).sort()).toEqual(['rsB', 'rsLEAD'])
})

// LocusZoom hosts headerless PLINK .ld files; the default column order is
// assumed and line 0 is kept as a data row rather than consumed as a header.
test('reads a headerless file via default PLINK columns', async () => {
  const adapter = makeAdapter('./test_data/headerless.ld')
  const records = await adapter.getLDRecords({
    refName: '1',
    start: 0,
    end: 5000,
  })
  expect(records).toHaveLength(4)
  const partner = records.find(r => r.snpB === 'rsB')!
  expect(partner.snpA).toBe('rsLEAD')
  expect(partner.bpB).toBe(1200)
  expect(partner.r2).toBeCloseTo(0.82)
})
