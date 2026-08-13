import HicFile from './index.ts'
import { openLocalTestHic } from './testFile.node.ts'

import type { Filehandle } from './types.ts'

// A `.hic` may carry no normalization at all, and then the file simply ENDS
// where its normalization data would have started. `readNormVectorIndex`'s
// discovery walk is two reads deep — skip the normalized expected values, then
// read the index after them — and only the second one guarded against coming
// back empty, so the first one ran its parser off a zero-length buffer.
//
// Reachable on a v9 file, which is the part that makes it easy to miss: v9
// records the index position in its header and is supposed to skip the walk
// entirely, but a file rebuilt without normalization records that position as 0
// and falls back to the v8 discovery path.
//
// It surfaced as a single `RangeError: Offset is outside the bounds of the
// DataView` in the console during a figure capture, on the one spec using such a
// file, and read as a decode fault in the multi-region fetch path that spec is
// also the only user of.

const RES = 2_500_000

// Serve `file` as if it were `cut` bytes long. Short reads, not throws: that is
// what a `generic-filehandle2` handle does at EOF, including translating the
// remote 416 the vendored code was written to catch.
function truncateAt(file: Filehandle, cut: number): Filehandle {
  return {
    async read(position: number, length: number) {
      const len = Math.min(length, cut - position)
      return len <= 0 ? new ArrayBuffer(0) : file.read(position, len)
    },
  }
}

// Cutting the real file where its normalized expected values begin leaves the
// shape being pinned: a complete, readable matrix followed by nothing.
async function openWithoutNormalization() {
  const file = openLocalTestHic()
  const probe = new HicFile({ file })
  await probe.getMetaData()
  const cut = probe.normExpectedValueVectorsPosition!
  expect(cut).toBeGreaterThan(0)

  const straw = new HicFile({ file: truncateAt(file, cut) })
  // As `HicAdapter.getHeader` does. Without it the version gate in
  // `getNormVectorIndex` reads a version of 0 and the walk never runs, which
  // makes every assertion below pass for the wrong reason.
  await straw.getMetaData()
  return straw
}

let err: jest.SpyInstance

beforeEach(() => {
  // The whole symptom was one console line, so silence is the assertion.
  err = jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  expect(err).not.toHaveBeenCalled()
  err.mockRestore()
})

test('a file whose normalization data is absent reports NONE', async () => {
  const straw = await openWithoutNormalization()
  await expect(straw.getNormalizationOptions()).resolves.toEqual(['NONE'])
})

test('contacts decode from such a file, normalization request and all', async () => {
  const straw = await openWithoutNormalization()

  // The same query and count `verify.test.ts` makes against the whole file, so
  // this says the missing normalization costs the caller nothing but the scheme
  // it asked for — which is why the figure that found this was correct while the
  // error was being thrown.
  const r = { chr: '1', start: 0, end: RES * 200 }
  const { records, appliedNormalization } = await straw.getContactRecords(
    'KR',
    r,
    r,
    'BP',
    RES,
  )
  expect(records.bin1.length).toBe(3957)
  expect(appliedNormalization).toBe('NONE')
})
