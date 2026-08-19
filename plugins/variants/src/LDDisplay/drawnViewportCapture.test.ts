import { createTestEnvironment } from './testEnv.ts'

// What `captureViewport()` buys at the call site. `ctx.isStale()` trips only on
// a newer fetch or a cancel, so a pan that arrives while the RPC is out leaves
// this fetch current and the commit still runs — against a matrix packed for the
// viewport the fetch was issued at. Committing a live re-read there would call
// those pixels fresh, `renderTransform` would leave them un-rescaled, and
// `svgReady` would let an export capture them.
test('a pan during the RPC leaves the fetch stamped with the issued viewport', async () => {
  const { display, view, mockRpcCall } = createTestEnvironment().createDisplay()
  // let afterAttach's dynamic import resolve and install its autoruns
  await new Promise(res => setTimeout(res, 0))

  let landData: ((result: unknown) => void) | undefined
  mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
    method === 'RenderLDData'
      ? new Promise(res => {
          landData = res
        })
      : 700_000,
  )

  const issuedOffsetPx = view.offsetPx
  const fetching = display.performLDFetch()
  // the byte-gate pre-flight resolves first, so the matrix RPC is a few
  // microtasks out; nothing here waits long enough to reach the 500ms debounce
  while (!landData) {
    await new Promise(res => setTimeout(res, 0))
  }
  view.scrollTo(issuedOffsetPx + 137)
  landData(null)
  await fetching

  expect(display.lastDrawnOffsetPx).toBe(issuedOffsetPx)
  expect(display.viewportFresh).toBe(false)
  expect(display.renderTransform.viewOffsetX).toBe(-(issuedOffsetPx + 137))
})
