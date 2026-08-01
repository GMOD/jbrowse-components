import { createTestEnvironment } from './testEnv.ts'

// Every HiC contact fetch is gated on `effectiveResolution`, which exists only
// once the one-shot `CoreGetInfo` lands. So that call failing is terminal for
// the display, not a degradation — and a terminal state that never reaches
// `error` is both a permanent loading scrim and an SVG export that never
// finishes, because `awaitSvgReady` has no time bound (ARCHITECTURE.md, "every
// resting state that never fetches must be terminal"). It used to go to a
// session snackbar, which left `error` unset.

function flush() {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

// the info autorun runs on attach, so the RPC behavior has to be in place
// before the display is created
test('a failed CoreGetInfo lands in the error phase, not a permanent scrim', async () => {
  const { createDisplay, mockRpcCall } = createTestEnvironment()
  mockRpcCall.mockRejectedValue(new Error('could not read .hic header'))
  const { display } = createDisplay()
  await flush()

  expect(display.effectiveResolution).toBeUndefined()
  expect(`${display.error}`).toContain('could not read .hic header')
  expect(display.displayPhase).toBe('error')
  // and the export can finish rather than hanging the whole view
  expect(display.svgReady).toBe(true)
})

test('retry re-reads the header instead of dropping back onto the scrim', async () => {
  const { createDisplay, mockRpcCall } = createTestEnvironment()
  mockRpcCall.mockRejectedValue(new Error('transient'))
  const { display } = createDisplay()
  await flush()
  expect(display.displayPhase).toBe('error')

  mockRpcCall.mockResolvedValue({ norms: ['KR'], resolutions: [5000, 25000] })
  display.reload()
  await flush()

  expect(display.availableResolutions).toEqual([5000, 25000])
  expect(display.effectiveResolution).toBeDefined()
  expect(display.error).toBeUndefined()
})
