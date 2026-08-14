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

// The throw is only one of the ways the prerequisite fails. A CoreGetInfo that
// *resolves* carrying no binsize list leaves `effectiveResolution` undefined
// just as thoroughly, with no exception to catch — so it needs its own
// `setError` or it is the same permanent scrim + hung export.
test.each([
  ['an empty resolution list', { norms: ['KR'], resolutions: [] }],
  ['no resolution list at all', { norms: ['KR'] }],
])('%s is terminal, not a permanent scrim', async (_label, info) => {
  const { createDisplay, mockRpcCall } = createTestEnvironment()
  mockRpcCall.mockResolvedValue(info)
  const { display } = createDisplay()
  await flush()

  expect(display.effectiveResolution).toBeUndefined()
  expect(`${display.error}`).toContain('resolutions')
  expect(display.displayPhase).toBe('error')
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

  // The retry contract check reports here, and the three assertions above are
  // why it is a false positive: the reload wakes both autoruns, the fetch one
  // runs first and declines because `effectiveResolution` is still undefined,
  // and the header that defines it lands a moment later and wakes it again.
  // Asserted rather than merely taken, so this stops pinning a known-wrong
  // report the moment either side changes. agent-docs/TODO.md §"The retry check
  // calls HiC's Retry dead, and it isn't".
  expect(takeDisplayContractReports().join('\n')).toMatch(
    /Retry is a dead button/,
  )
})
