import HicFile from './index.ts'
import { openLocalTestHic } from './testFile.ts'

test('parses real .hic file', async () => {
  const straw = new HicFile({ file: openLocalTestHic() })
  const meta = await straw.getMetaData()
  expect(meta.version).toBe(8)
  expect(meta.resolutions).toEqual([2500000, 100000])
  expect(meta.chromosomes.length).toBe(26)

  const res = meta.resolutions[0]!
  const r = { chr: '1', start: 0, end: res * 200 }
  const { records: recs } = await straw.getContactRecords(
    'NONE',
    r,
    r,
    'BP',
    res,
  )
  expect(recs.bin1.length).toBe(3957)
  // the three arrays are parallel and always exactly the same length
  expect(recs.bin2.length).toBe(3957)
  expect(recs.counts.length).toBe(3957)
  expect([recs.bin1[0], recs.bin2[0], recs.counts[0]]).toEqual([0, 0, 785])
  expect([recs.bin1[2], recs.bin2[2], recs.counts[2]]).toEqual([1, 1, 942])

  const norms = await straw.getNormalizationOptions()
  expect(norms).toEqual(['NONE', 'VC', 'VC_SQRT', 'KR', 'SCALE'])

  // exercise KR normalization (reads norm vector index for v8 file)
  const kr = await straw.getContactRecords('KR', r, r, 'BP', res)
  expect(kr.records.bin1.length).toBeGreaterThan(0)
  expect(kr.appliedNormalization).toBe('KR')

  // A viewport block never lands on a bin boundary, so this is what the display
  // actually asks for. Every bin overlapping the region must come back — the
  // bin straddling the start included, which the fractional bin window dropped.
  const offset = { chr: '1', start: res / 2, end: res * 10 + res / 2 }
  const { records: offsetRecs } = await straw.getContactRecords(
    'NONE',
    offset,
    offset,
    'BP',
    res,
  )
  expect([...offsetRecs.bin1]).toContain(0)
  // and the window is [floor(start/res), ceil(end/res)) = [0, 11)
  expect(Math.min(...offsetRecs.bin1)).toBe(0)
  expect(Math.max(...offsetRecs.bin2)).toBe(10)
})
