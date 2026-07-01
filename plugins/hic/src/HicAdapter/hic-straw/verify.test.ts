import { fstatSync, openSync, readSync } from 'node:fs'
import path from 'node:path'

import HicStraw from './index.ts'

import type { Filehandle } from './types.ts'

function openLocal(p: string): Filehandle {
  const fd = openSync(p, 'r')
  const size = fstatSync(fd).size
  return {
    read(position: number, length: number) {
      const len = Math.min(length, size - position)
      if (len <= 0) {
        return Promise.resolve(new ArrayBuffer(0))
      }
      const buf = new Uint8Array(len)
      readSync(fd, buf, 0, len, position)
      return Promise.resolve(
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      )
    },
  }
}

test('parses real .hic file', async () => {
  const file = openLocal(
    path.join(__dirname, '../../../../../extra_test_data/test.hic'),
  )
  const straw = new HicStraw({ file })
  const meta = await straw.getMetaData()
  expect(meta.version).toBe(8)
  expect(meta.resolutions).toEqual([2500000, 100000])
  expect(meta.chromosomes.length).toBe(26)

  const res = meta.resolutions[0]!
  const r = { chr: '1', start: 0, end: res * 200 }
  const recs = await straw.getContactRecords('NONE', r, r, 'BP', res)
  expect(recs.length).toBe(3957)
  expect(recs[0]).toMatchObject({ bin1: 0, bin2: 0, counts: 785 })
  expect(recs[2]).toMatchObject({ bin1: 1, bin2: 1, counts: 942 })

  const norms = await straw.getNormalizationOptions()
  expect(norms).toEqual(['NONE', 'VC', 'VC_SQRT', 'KR', 'SCALE'])

  // exercise KR normalization (reads norm vector index for v8 file)
  const krRecs = await straw.getContactRecords('KR', r, r, 'BP', res)
  expect(krRecs.length).toBeGreaterThan(0)
})
