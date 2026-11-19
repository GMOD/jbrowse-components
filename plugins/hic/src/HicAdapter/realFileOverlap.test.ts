import HicAdapter from './HicAdapter.ts'
import configSchema from './configSchema.ts'

const HIC = require.resolve('../../../../extra_test_data/test.hic')
const RES = 2_500_000

// Two displayed regions of chr1, the second nested in the first. The block
// between them holds every contact with one end in each: a contact the file
// stores mirrored, and one inside both windows at both its cells.
test('the block between two nested regions of one chromosome is the whole rectangle', async () => {
  const adapter = new HicAdapter(
    configSchema.create({
      hicLocation: { localPath: HIC, locationType: 'LocalPathLocation' },
    }),
  )
  const outer = { assemblyName: 'hg19', refName: '1', start: 50e6, end: 150e6 }
  const inner = { assemblyName: 'hg19', refName: '1', start: 50e6, end: 80e6 }
  const { pairs } = await adapter.getMultiRegionContactRecords([outer, inner], {
    resolution: RES,
    normalization: 'NONE',
  })
  const block = pairs.find(p => p.region1Idx === 0 && p.region2Idx === 1)!
  const cells = new Set(
    Array.from(block.bin1, (b1, i) => `${b1},${block.bin2[i]}`),
  )
  const innerEnd = inner.end / RES
  expect(Array.from(block.bin1).some(b1 => b1 >= innerEnd)).toBe(true)
  expect(Array.from(block.bin2).every(b2 => b2 < innerEnd)).toBe(true)
  expect(
    Array.from(block.bin1).some(
      (b1, i) =>
        b1 !== block.bin2[i] &&
        b1 < innerEnd &&
        cells.has(`${block.bin2[i]},${b1}`),
    ),
  ).toBe(true)
})
