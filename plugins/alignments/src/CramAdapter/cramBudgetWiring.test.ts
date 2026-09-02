import { BamFile } from '@gmod/bam'
import { CraiIndex, IndexedCramFile } from '@gmod/cram'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { LocalFile } from 'generic-filehandle2'

// The CRAM half of BamAdapter/budgetWiring.test.ts: a CRAM and a BAM that
// never see each other land in the one total, and what the CRAM reports is
// its slices' bytes rather than a record count. Until @gmod/cram 14 the slice
// cache weighed records, and the two formats had to keep separate budgets.
test('a CRAM and a BAM report into the one shared budget, in bytes', async () => {
  const before = decompressedBytesBudget.total
  const cramPath = require.resolve('../../test_data/volvox-sorted.cram')
  const bamPath = require.resolve('../../test_data/volvox-sorted.bam')
  const cram = new IndexedCramFile({
    cramFilehandle: new LocalFile(cramPath),
    index: new CraiIndex({ filehandle: new LocalFile(`${cramPath}.crai`) }),
    fetchReferenceSequence: async (
      _seqId: number,
      start: number,
      end: number,
    ) => 'A'.repeat(end - start),
    checkSequenceMD5: false,
    useSliceWorkerPool: false,
    cacheBudget: decompressedBytesBudget,
  })
  const bam = new BamFile({
    bamFilehandle: new LocalFile(bamPath),
    baiFilehandle: new LocalFile(`${bamPath}.bai`),
    cacheBudget: decompressedBytesBudget,
  })

  await bam.getHeader()
  const records = await cram.getRecordsForRange(0, 0, 50000)
  await bam.getRecordsForRange('ctgA', 0, 50000)

  const cramHeld = cram.cram.featureCache.totalSize
  expect(records.length).toBeGreaterThan(0)
  expect(cramHeld).toBeGreaterThan(records.length * 16)
  expect(decompressedBytesBudget.total - before).toBe(
    cramHeld + bam.chunkFeatureCache.totalSize,
  )
  // the per-file ceiling is the library default, the same 1 GB the budget
  // holds, so the budget is what binds from the second file on
  expect(cram.cram.featureCache.maxSize).toBe(1024 * 1024 * 1024)
})
