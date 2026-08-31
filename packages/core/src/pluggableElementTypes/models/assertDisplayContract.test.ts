/**
 * The double-attach check.
 *
 * A fetch foundation installs a display's autoruns from `afterAttach`, so
 * reaching that hook twice on one node installs every one of them twice —
 * double fetches, double clears, and nothing at any layer says so. The state is
 * the violation, which is why this one stayed a runtime check when the
 * declaration-shaped contracts around it became `no-restricted-syntax`
 * selectors (ARCHITECTURAL_LIMITS.md §"Ordering is the contract").
 *
 * It reports through `console.error` on purpose rather than throwing, because
 * an error escaping `afterAttach` is read by the session loader as an invalid
 * track and the display is dropped — hiding the violation being reported. That
 * makes the reporting channel part of the contract, so these assert on it.
 */
import { types } from '@jbrowse/mobx-state-tree'

import { assertDisplayContract } from './assertDisplayContract.ts'

// Through the jest gate (`config/jest/contractGate.js`) rather than a
// local `console.error` swap, which is what this did before: swapping it out
// hides the reports from the gate instead of excusing them, so the file that
// provokes violations on purpose was also the file the gate could never see.
// Taking them is the opt-in.
function captureReports(fn: () => void) {
  fn()
  return takeContractReports()
}

const Display = types
  .model('SomeDisplay', { id: types.optional(types.string, 'x') })
  .views(() => ({
    rpcProps() {
      return {}
    },
  }))

test('one call per node reports nothing', () => {
  expect(
    captureReports(() => {
      assertDisplayContract(Display.create())
    }),
  ).toEqual([])
})

// Our MST fork auto-chains lifecycle hooks, so a display that also calls
// superAfterAttach() installs all five fetch autoruns twice. Composing two
// fetch foundations, or calling an installer a mixin already called, lands the
// same way — which is why the message names the common cause and then the
// state, and why a lint selector on the super-capture would not replace this.
test('a second call on the same node reports the double attach', () => {
  const node = Display.create()
  assertDisplayContract(node)
  const reports = captureReports(() => {
    assertDisplayContract(node)
  })
  expect(reports).toHaveLength(1)
  expect(reports[0]).toMatch(/ran twice on one display/)
  expect(reports[0]).toMatch(/superAfterAttach\(\) call/)
  expect(reports[0]).toMatch(/composes two fetch foundations/)
  expect(reports[0]).toMatch(/SomeDisplay/)
})

// The message has to name the caller that ran twice, or a display composing the
// global foundation is told to look at the per-region one.
test('the report names whichever foundation installed the autoruns', () => {
  const node = Display.create()
  assertDisplayContract(node, 'installGlobalFetchAutorun')
  const reports = captureReports(() => {
    assertDisplayContract(node, 'installGlobalFetchAutorun')
  })
  expect(reports[0]).toMatch(/installGlobalFetchAutorun ran twice/)
})

// Keyed per node, not per model type — every display of a type would otherwise
// report from the second one onward.
test('a different node of the same type is not a double attach', () => {
  assertDisplayContract(Display.create())
  expect(
    captureReports(() => {
      assertDisplayContract(Display.create())
    }),
  ).toEqual([])
})
