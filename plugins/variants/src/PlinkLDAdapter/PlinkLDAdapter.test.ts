import PlinkLDAdapter from './PlinkLDAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter(f: string) {
  return new PlinkLDAdapter(
    configSchema.create({
      ldLocation: { localPath: require.resolve(f), locationType: 'LocalPathLocation' },
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
