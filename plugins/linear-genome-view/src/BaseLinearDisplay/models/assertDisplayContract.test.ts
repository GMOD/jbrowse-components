/**
 * The dev-only display-contract check.
 *
 * `BaseLinearDisplay/CLAUDE.md` leans on this directly — "a new fetching
 * display needs no per-family `getMembers` test" — so if it silently stopped
 * checking, the guidance would be wrong and nothing would say so. Its whole
 * mechanism is a `getMembers(self).actions` lookup against a name list: a
 * change in what our MST fork reports there turns every violation into a pass,
 * which looks exactly like a clean codebase.
 *
 * It reports through `console.error` on purpose rather than throwing, because
 * an error escaping `afterAttach` is read by the session loader as an invalid
 * track and the display is dropped — hiding the violation being reported. That
 * makes the reporting channel part of the contract, so these assert on it.
 */
import { types } from '@jbrowse/mobx-state-tree'

import { assertDisplayContract } from './assertDisplayContract.ts'

// Through the jest gate (`config/jest/displayContractGate.js`) rather than a
// local `console.error` swap, which is what this did before: swapping it out
// hides the reports from the gate instead of excusing them, so the file that
// provokes violations on purpose was also the file the gate could never see.
// Taking them is the opt-in.
function captureReports(fn: () => void) {
  fn()
  return takeDisplayContractReports()
}

// rpcProps and isCacheValid are the two hooks MobX would run untracked if they
// were actions, so their reads would register no dependency and every caller
// would keep a stale answer. Nothing about the wrong block fails to compile.
const Offender = types
  .model('OffendingDisplay', { id: types.optional(types.string, 'x') })
  .actions(() => ({
    rpcProps() {
      return {}
    },
    isCacheValid() {
      return true
    },
  }))

const Correct = types
  .model('CorrectDisplay', { id: types.optional(types.string, 'x') })
  .views(() => ({
    rpcProps() {
      return {}
    },
    isCacheValid() {
      return true
    },
  }))

test('a hook declared in .actions() is reported, naming the hook and the fix', () => {
  const reports = captureReports(() => {
    assertDisplayContract(Offender.create())
  })
  expect(reports).toHaveLength(2)
  expect(reports.join('\n')).toMatch(/`rpcProps` is declared in \.actions\(\)/)
  expect(reports.join('\n')).toMatch(
    /`isCacheValid` is declared in \.actions\(\)/,
  )
  // the message has to say what to do; "violates the contract" costs the hours
  // this check exists to save
  expect(reports.join('\n')).toMatch(/Move it to a \.views\(\) block/)
  expect(reports.join('\n')).toMatch(/OffendingDisplay/)
})

// The negative control that matters: if getMembers ever stops reporting action
// names the way this reads them, every display passes and the check is dead
// weight. The pair only proves anything together.
test('the same hooks in .views() report nothing', () => {
  expect(
    captureReports(() => {
      assertDisplayContract(Correct.create())
    }),
  ).toEqual([])
})

// Our MST fork auto-chains lifecycle hooks, so a display that also calls
// superAfterAttach() installs all five fetch autoruns twice — double fetches,
// double clears. Re-entering on the same node is the only way that happens.
test('a second call on the same node reports the double attach', () => {
  const node = Correct.create()
  expect(
    captureReports(() => {
      assertDisplayContract(node)
    }),
  ).toEqual([])
  const reports = captureReports(() => {
    assertDisplayContract(node)
  })
  expect(reports).toHaveLength(1)
  expect(reports[0]).toMatch(/afterAttach ran twice/)
  expect(reports[0]).toMatch(/delete the superAfterAttach\(\) call/)
})

// Keyed per node, not per model type — every display of a type would otherwise
// report from the second one onward.
test('a different node of the same type is not a double attach', () => {
  assertDisplayContract(Correct.create())
  expect(
    captureReports(() => {
      assertDisplayContract(Correct.create())
    }),
  ).toEqual([])
})
