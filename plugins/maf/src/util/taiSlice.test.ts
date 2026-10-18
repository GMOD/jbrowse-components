import { readToEnd } from './taiSlice.ts'

import type { openLocation } from '@jbrowse/core/util/io'

function fakeFile(size: number) {
  const data = Uint8Array.from({ length: size }, (_, i) => i & 255)
  const reads: number[] = []
  const file = {
    read: async (length: number, position: number) => {
      reads.push(length)
      return data.slice(position, position + length)
    },
  } as unknown as ReturnType<typeof openLocation>
  return { data, reads, file }
}

test('reads to the end of the file in doubling steps', async () => {
  const { data, reads, file } = fakeFile(500_000)
  expect(await readToEnd(file, 1000, 65_536)).toEqual(data.slice(1000))
  expect(reads).toEqual([65_536, 131_072, 262_144, 524_288])
})

test('a tail shorter than the first step is one read', async () => {
  const { data, reads, file } = fakeFile(70_000)
  expect(await readToEnd(file, 50_000, 65_536)).toEqual(data.slice(50_000))
  expect(reads).toEqual([65_536])
})
