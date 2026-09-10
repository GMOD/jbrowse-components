/**
 * @jest-environment node
 *
 * The nesting, walked rather than re-read. `open` shipped with its inner settle
 * on the default relay budget, and the two summed past what the stdio client
 * waits — which answers "did not answer in time" over a bridge still working.
 */
import {
  BRIDGE_TIMEOUT_MS,
  CODE_TIMEOUT_DEFAULT_MS,
  CODE_TIMEOUT_MAX_MS,
  LONGEST_CALL_MS,
  OPEN_SETTLE_MS,
  OPEN_WAIT_MS,
  RELAY_MARGIN_MS,
  RENDERER_TIMEOUT_MS,
  SCREENSHOT_WAIT_MAX_MS,
  SCREENSHOT_WAIT_MS,
  relayBudget,
} from './budgets.ts'

// Every socket call the bridge can be legitimately working on, and how long the
// worst case of each takes. Read the same way the code composes them, so a hop
// added without a budget shows up as a missing row rather than a silent pass.
const CALLS = {
  run_javascript: relayBudget(CODE_TIMEOUT_MAX_MS),
  open: OPEN_WAIT_MS + relayBudget(OPEN_SETTLE_MS),
  screenshot: relayBudget(SCREENSHOT_WAIT_MAX_MS),
  'an undeclared relay (measure, paint)': RENDERER_TIMEOUT_MS,
}

describe('the deadlines nest', () => {
  it.each(Object.entries(CALLS))(
    'the client outwaits %s',
    (_name, worstCase) => {
      expect(worstCase).toBeLessThan(BRIDGE_TIMEOUT_MS)
    },
  )

  it('leaves a whole margin over the longest of them', () => {
    expect(LONGEST_CALL_MS).toBe(Math.max(...Object.values(CALLS)))
    expect(BRIDGE_TIMEOUT_MS - LONGEST_CALL_MS).toBe(RELAY_MARGIN_MS)
  })

  // the renderer clamps to its own maximum, so a relay budgeted from a bigger
  // number would be waiting on work that already gave up
  it('budgets a relay past the deadline the far side will honour', () => {
    expect(relayBudget(CODE_TIMEOUT_MAX_MS)).toBeGreaterThan(
      CODE_TIMEOUT_MAX_MS,
    )
    expect(CODE_TIMEOUT_DEFAULT_MS).toBeLessThanOrEqual(CODE_TIMEOUT_MAX_MS)
    expect(SCREENSHOT_WAIT_MS).toBeLessThanOrEqual(SCREENSHOT_WAIT_MAX_MS)
  })
})
