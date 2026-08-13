import { fstatSync, openSync, readSync } from 'node:fs'
import path from 'node:path'

import type { Filehandle } from './types.ts'

/**
 * `extra_test_data/test.hic` (v8, hg19) as a `Filehandle`.
 *
 * Shared by the suites that read the real file rather than a synthesized block,
 * because the clamp below is the part worth getting right once: `HicFile` reads
 * speculatively past the end — the master-index size estimate, and the
 * norm-vector index probe that expects a zero-length buffer to mean "this file
 * has no norm vectors" — so a short read must come back short, not throw.
 */
export function openLocalTestHic(): Filehandle {
  const fd = openSync(
    path.join(__dirname, '../../../../../extra_test_data/test.hic'),
    'r',
  )
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
