import { BamFile } from '@gmod/bam'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { LocalFile } from 'generic-filehandle2'

// Proves the budget is wired rather than merely accepted: two files that never
// see each other must land in the same total. Typechecking only establishes
// that `cacheBudget` is a known option — see ADR-064.
test('two BamFiles report into the one shared budget', async () => {
  const before = decompressedBytesBudget.total
  const open = () =>
    new BamFile({
      bamFilehandle: new LocalFile(
        require.resolve('../../test_data/volvox-sorted.bam'),
      ),
      baiFilehandle: new LocalFile(
        require.resolve('../../test_data/volvox-sorted.bam.bai'),
      ),
      cacheBudget: decompressedBytesBudget,
    })

  const a = open()
  const b = open()
  await a.getHeader()
  await b.getHeader()
  await a.getRecordsForRange('ctgA', 0, 50000)
  await b.getRecordsForRange('ctgA', 0, 50000)

  const held = a.chunkFeatureCache.totalSize + b.chunkFeatureCache.totalSize
  expect(held).toBeGreaterThan(0)
  expect(decompressedBytesBudget.total - before).toBe(held)
  // the per-file ceiling is still the library default, i.e. not what bounds
  expect(a.chunkFeatureCache.maxSize).toBe(1024 * 1024 * 1024)
})
