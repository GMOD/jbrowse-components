import { getMembers, types } from '@jbrowse/mobx-state-tree'

import RegionTooLargeMixin, {
  RENAMED_HOOKS,
  reportRenamedHooks,
} from './RegionTooLargeMixin.ts'

// The gate members were renamed in 2026-08 (`byteGateEnabled` →
// `measuresBytesPreFlight`, `byteGateActive` → `gateActive`, …). An out-of-tree
// display still overriding an old name lands on a getter nothing reads: the gate
// quietly stays off and the track downloads unguarded, with no banner and no
// error — the same silent-disable this mixin's additive OR and the compose-order
// lint rule exist to prevent. A lint rule is no use for this one, because the
// population it is for never runs our lint. So `afterAttach` calls
// `reportRenamedHooks`, and a dev check nobody tests is a check that stops
// firing without anyone noticing.
//
// Called directly rather than through `afterAttach`, because MST materializes
// child nodes lazily and there is no display fixture in this package to attach
// one to. The two things that can actually rot are both covered: the reporting
// itself, and whether the map still describes reality (last test).

function displayDeclaring(views: Record<string, () => unknown>) {
  const M = types.model('StaleNameDisplay', {}).views(() => views)
  return M.create()
}

// Read through the jest gate (`config/jest/contractGate.js`), which
// buffers what the check reports and fails any test that leaves a report
// unclaimed. Taking them is how this file says its violations are on purpose —
// a `console.error` spy, which this used before, hid them from the gate instead.
test('reports an override left on a renamed hook, naming the new name', () => {
  reportRenamedHooks(
    displayDeclaring({
      byteGateEnabled: () => true,
    }),
  )

  const errors = takeContractReports()
  expect(errors).toHaveLength(1)
  expect(errors[0]).toContain('byteGateEnabled')
  expect(errors[0]).toContain('measuresBytesPreFlight')
})

test('reports every renamed name the display still declares', () => {
  reportRenamedHooks(
    displayDeclaring({
      gateFoldedIntoFetch: () => true,
      byteGateActive: () => true,
    }),
  )

  const errors = takeContractReports()
  expect(errors).toHaveLength(2)
  expect(errors.join('\n')).toContain('measuresBytesInFetch')
  expect(errors.join('\n')).toContain('gateActive')
})

test('says nothing about a display using the current names', () => {
  reportRenamedHooks(
    displayDeclaring({
      measuresBytesPreFlight: () => true,
    }),
  )

  expect(takeContractReports()).toEqual([])
})

// The map is only useful while both halves are true: the old name is gone, and
// the new one exists. A rename that forgot to update the map here would report a
// name that is still live, or point at one that never landed.
test('the map names members the mixin has dropped, and replacements it has', () => {
  const mixin = types
    .compose('GateOnly', RegionTooLargeMixin(), types.model({}))
    .create()
  // `getMembers(...).views`, the same reflection `reportRenamedHooks` uses — so
  // this and the check can't disagree about what counts as declared
  const declared = new Set(getMembers(mixin).views)

  for (const old of Object.keys(RENAMED_HOOKS)) {
    expect(declared.has(old)).toBe(false)
  }
  for (const current of Object.values(RENAMED_HOOKS)) {
    // `gateViewport?.spanBp` is an expression, not a member — the one entry
    // whose replacement is "read this other getter" rather than a rename
    if (!current.includes('.')) {
      expect(declared.has(current)).toBe(true)
    }
  }
})
