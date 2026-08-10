import { getMembers, types } from '@jbrowse/mobx-state-tree'

import RegionTooLargeMixin, {
  RENAMED_HOOKS,
  reportRenamedHooks,
} from './RegionTooLargeMixin.ts'

// The gate members were renamed in 2026-08 (`byteGateEnabled` →
// `measuresBytesPreFlight`, `byteGateActive` → `gateActive`, …). An out-of-tree
// display still overriding an old name lands on a getter nothing reads: the gate
// quietly stays off and the track downloads unguarded, with no banner and no
// error — the same silent-disable this mixin's additive OR and
// `CanvasFeatureGateMixin`'s compose-order check exist to prevent. So
// `afterAttach` calls `reportRenamedHooks`, and a dev check nobody tests is a
// check that stops firing without anyone noticing.
//
// Called directly rather than through `afterAttach`, because MST materializes
// child nodes lazily and there is no display fixture in this package to attach
// one to. The two things that can actually rot are both covered: the reporting
// itself, and whether the map still describes reality (last test).

function displayDeclaring(views: Record<string, () => unknown>) {
  const M = types.model('StaleNameDisplay', {}).views(() => views)
  return M.create()
}

let errors: string[]
beforeEach(() => {
  errors = []
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '))
  })
})
afterEach(() => {
  jest.restoreAllMocks()
})

test('reports an override left on a renamed hook, naming the new name', () => {
  reportRenamedHooks(
    displayDeclaring({
      byteGateEnabled: () => true,
    }),
  )

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

  expect(errors).toEqual([])
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
