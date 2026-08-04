import PlinkLDTabixAdapter from './PlinkLDTabixAdapter.ts'
import configSchema from './configSchemaTabix.ts'

function makeAdapter(f: string) {
  return new PlinkLDTabixAdapter(
    configSchema.create({
      ldLocation: {
        localPath: require.resolve(f),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve(`${f}.tbi`),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
}

// The fixture is indexed the way a plink .ld actually gets indexed: `tabix -S 1`,
// because its header row carries no `#`. That makes tabix's getHeader() return
// nothing, which used to drop the column layout to the headerless default and
// take the D' column with it — so `ldMetric: 'dprime'` served r² while the
// legend still said D'. The adapter reads the file's own first line when tabix
// has no header to give.
test('finds the D column in a file whose header tabix will not return', async () => {
  const adapter = makeAdapter('./test_data/dprime.ld.gz')
  expect((await adapter.getHeader()).dprimeIdx).toBe(7)
})

test('parses D and r2 as separate values', async () => {
  const adapter = makeAdapter('./test_data/dprime.ld.gz')
  const records = await adapter.getLDRecords({
    refName: '1',
    start: 0,
    end: 5000,
  })
  const partner = records.find(r => r.snpB === 'rsB')!
  expect(partner.r2).toBeCloseTo(0.25)
  expect(partner.dprime).toBeCloseTo(0.91)
})

test('exposes refNames from the index', async () => {
  const adapter = makeAdapter('./test_data/dprime.ld.gz')
  expect(await adapter.getRefNames()).toEqual(['1'])
})

// The other way a header survives tabix: commented out, so the index's meta
// character covers it and getHeader() returns it. The `#` belongs to the
// comment, not to the first column's name — leaving it attached threw
// "Expected columns CHR_A, BP_A, CHR_B, BP_B" and took the whole track down.
test('reads a commented header', async () => {
  const adapter = makeAdapter('./test_data/dprime_hash.ld.gz')
  expect((await adapter.getHeader()).dprimeIdx).toBe(7)
  const records = await adapter.getLDRecords({
    refName: '1',
    start: 0,
    end: 5000,
  })
  expect(records.find(r => r.snpB === 'rsB')!.dprime).toBeCloseTo(0.91)
})

// A headerless file whose chromosome column reads CHR1 is the case that decides
// how the first line may be used. Its first line matches the "looks like a
// header" pattern while being data, so inferring a header from content throws
// here and loses the file. The index is asked instead (skipLines is 0), so the
// line is never read as a header and the default layout stands.
test('keeps a headerless file whose chrom column looks like a header', async () => {
  const adapter = makeAdapter('./test_data/headerless_chr1.ld.gz')
  const records = await adapter.getLDRecords({
    refName: 'CHR1',
    start: 0,
    end: 5000,
  })
  expect(records).toHaveLength(2)
  expect(records[0]!.r2).toBeCloseTo(0.82)
  expect((await adapter.getHeader()).dprimeIdx).toBe(-1)
})
