import HicFile from './index.ts'
import { openLocalTestHic } from './testFile.ts'

import type { Filehandle, HicRegion } from './types.ts'

/**
 * What a remote `.hic` actually pays is round-trip DEPTH, not read count: reads
 * issued together cost one wait, reads issued one-after-another cost one each.
 * A read-counting test cannot tell those apart, and the regression this guards
 * — awaiting two independent chains in sequence — changes only the depth.
 *
 * So: batch every read issued in the same macrotask turn and resolve the batch
 * together, counting the drains. That is the sequential-hop count a network
 * would charge, made deterministic.
 */
function batchingFile(inner: Filehandle) {
  let pending: (() => void)[] = []
  let scheduled = false
  const state = { waves: 0, reads: 0 }
  return {
    state,
    read(position: number, length: number) {
      state.reads++
      return new Promise<ArrayBuffer>(resolve => {
        pending.push(() => {
          resolve(inner.read(position, length))
        })
        if (!scheduled) {
          scheduled = true
          setTimeout(() => {
            scheduled = false
            state.waves++
            const batch = pending
            pending = []
            for (const drain of batch) {
              drain()
            }
          }, 0)
        }
      })
    },
  }
}

const RES = 2_500_000
const region = (chr: string): HicRegion => ({ chr, start: 0, end: 20_000_000 })

/** A file with the header and normalization index already read, as every fetch
 * after the first one has. Measuring from cold would fold the one-time header
 * walk into every number. */
async function warmFile() {
  const file = batchingFile(openLocalTestHic())
  const hic = new HicFile({ file })
  await hic.getMetaData()
  await hic.getNormalizationOptions()
  file.state.waves = 0
  file.state.reads = 0
  return { hic, state: file.state }
}

test('a region pair costs the DEEPER of its two read chains, not their sum', async () => {
  const { hic, state } = await warmFile()
  const r = region('1')
  await hic.getContactRecords('KR', r, r, 'BP', RES)

  // Two hops: the two chains overlap, so the pair costs one chain's depth.
  // Awaiting them in sequence — which is what this file used to do — makes it 4,
  // and nothing else about the fetch changes, which is why read count can't see
  // it.
  expect(state.waves).toBe(2)
})

// The two halves of the claim above. Both chains being the same depth is also
// why shortening the norm chain further (deriving its value count from the
// index entry instead of reading it) would buy nothing: the pair would still
// wait `max(chain)` = 2 on the blocks.
test.each([
  [
    'normalization vectors',
    (hic: HicFile) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- private, and the point is the chain it issues
      (hic as any).getNormVectors('KR', region('3'), region('3'), 'BP', RES),
  ],
  ['blocks', (hic: HicFile) => hic.getBlocks(region('3'), region('3'), RES)],
])('the %s chain is two hops on its own', async (_name, run) => {
  const { hic, state } = await warmFile()
  await run(hic)
  expect(state.waves).toBe(2)
})

test('a cold open pays the header walk once, not per pair', async () => {
  const file = batchingFile(openLocalTestHic())
  const hic = new HicFile({ file })
  const r = region('1')
  await hic.getContactRecords('KR', r, r, 'BP', RES)
  const cold = file.state.waves

  file.state.waves = 0
  const r2 = region('2')
  await hic.getContactRecords('KR', r2, r2, 'BP', RES)
  // a different chromosome, so nothing about this pair is cached except the
  // header and the normalization index — which is the whole difference
  expect(file.state.waves).toBe(2)
  expect(cold).toBeGreaterThan(file.state.waves)
})
