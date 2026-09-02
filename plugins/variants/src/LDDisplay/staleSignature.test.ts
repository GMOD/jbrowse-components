import { waitFor } from '@testing-library/react'

import { createTestEnvironment } from './testEnv.ts'

import type { LDDataResult } from '../RenderLDDataRPC/types.ts'

// What stamping the ISSUED signature buys at the commit. `ctx.isStale()` trips
// only on a newer fetch or a cancel, so a pan that arrives while the RPC is out
// leaves this fetch current and the commit still runs — against a matrix laid
// out for the blocks the fetch was issued over. Stamping a live re-read there
// would call that matrix fresh and `svgReady` would let an export capture it.
// Meanwhile the live transform places the stale triangle at the payload's own
// genomic origin, so it draws in the right place under the moved viewport with
// no rescale machinery.
test('a pan during the RPC leaves the fetch stamped with the issued signature', async () => {
  const { display, view, mockRpcCall } = createTestEnvironment().createDisplay()
  // let afterAttach's dynamic import resolve and install its autoruns
  await new Promise(res => setTimeout(res, 0))

  // the first matrix RPC is held open; a later one, issued for the moved
  // viewport, stays pending and never lands
  let landData: ((result: LDDataResult) => void) | undefined
  mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
    method === 'RenderLDData'
      ? new Promise(res => {
          landData ??= res
        })
      : 700_000,
  )

  // a new block set, so the installed autorun issues a fetch for it
  view.zoomTo(10)
  const issuedOffsetPx = view.offsetPx
  const issuedSignature = display.currentFetchKey
  await waitFor(
    () => {
      expect(landData).toBeDefined()
    },
    { timeout: 3000 },
  )
  view.scrollTo(issuedOffsetPx + 137)
  landData!({
    ldValues: new Float32Array(0),
    boundaries: new Float32Array(0),
    numCells: 0,
    band: 1_000_000,
    uniformW: 0,
    originBp: 500,
    genomicMode: false,
    metric: 'r2',
    hasDprime: true,
    method: 'phased',
    signedLD: false,
    snps: [],
  })
  await waitFor(() => {
    expect(display.loadedFetchKey).toBe(issuedSignature)
  })

  // the pan moved the block set out from under the fetch, so the data is not
  // current and an export waits for the refetch
  expect(display.dataCurrent).toBe(false)
  // the stale triangle draws at the payload's own origin under the live view
  expect(display.viewTransform.viewOffsetX).toBe(
    500 / view.bpPerPx - (issuedOffsetPx + 137),
  )
})
