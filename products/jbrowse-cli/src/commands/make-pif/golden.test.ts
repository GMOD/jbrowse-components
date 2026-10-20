/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

import { runCommand, runInTmpDir } from '../../testUtil.ts'
import { PIF_FORMAT_VERSION } from './pif-generator.ts'

// These goldens pin the uncompressed bytes make-pif hands to bgzip: the
// `#pif` header and every row, in sorted order. Downstream pipelines rebuild a
// PIF only when `make-pif --format-version` changes, so a byte change here
// ships to them silently unless PIF_FORMAT_VERSION moves with it. bgzip and
// tabix are outside this contract.
const dir = path.join(__dirname, '..', '..', '..', 'test', 'data', 'pif-golden')
const input = path.join(dir, 'input.paf')

const CHANGED = `make-pif's uncompressed output changed. Change these bytes only together with a PIF_FORMAT_VERSION bump (now ${PIF_FORMAT_VERSION}, in pif-generator.ts and in the reader's plugins/comparative-adapters/src/util.ts), which you owe whenever a reader of generation ${PIF_FORMAT_VERSION} would misread the new bytes or files already built should be rebuilt. For a change reviewers accept as no format change, regenerate the goldens deliberately with UPDATE_PIF_GOLDEN=1 and say why in the commit message.`

test.each([
  ['default.pif', []],
  ['coarse-500.pif', ['--coarse', '500']],
  ['no-coarse.pif', ['--no-coarse']],
])('make-pif writes the bytes of %s', async (golden, args) => {
  const goldenPath = path.join(dir, golden)
  await runInTmpDir(async () => {
    const { error } = await runCommand([
      'make-pif',
      input,
      '--out',
      'out.pif.gz',
      ...args,
    ])
    expect(error).toBeUndefined()
    const actual = gunzipSync(fs.readFileSync('out.pif.gz'))
    if (process.env.UPDATE_PIF_GOLDEN === '1') {
      fs.writeFileSync(goldenPath, actual)
    }
    const expected = fs.readFileSync(goldenPath)
    if (!actual.equals(expected)) {
      throw new Error(
        `${CHANGED}\n\n--- ${golden}\n${expected.toString()}\n+++ make-pif\n${actual.toString()}`,
      )
    }
  })
})
