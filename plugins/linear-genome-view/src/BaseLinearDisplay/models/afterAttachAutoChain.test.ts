import { types } from '@jbrowse/mobx-state-tree'

import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

// Load-bearing fork behavior: @jbrowse/mobx-state-tree AUTO-CHAINS lifecycle
// hooks. When a composed model defines `afterAttach` (or any Hook) and a base
// already defined one, the fork wraps them `() => { base(); subclass(); }` — the
// base runs automatically, WITHOUT the subclass capturing/calling super.
//
// Our LGV-display convention depends on this: `MultiRegionDisplayMixin.afterAttach`
// installs the fetch autoruns, and a display's own `afterAttach` must NOT
// explicitly `superAfterAttach()` — the auto-chain already runs it. Doing both
// runs the base afterAttach TWICE, double-installing every mixin autorun. These
// tests pin the behavior so a fork upgrade that changed it (or a reintroduced
// explicit super-capture) is caught.

// Attach `Sub` as a child so its `afterAttach` fires, and return the call log.
function runAttach(Sub: IAnyModelType) {
  types
    .model('Root', { child: types.maybe(Sub) })
    .actions(self => ({
      attach() {
        self.child = Sub.create({})
      },
    }))
    .create({})
    .attach()
}

test('a subclass afterAttach WITHOUT super-capture still runs the base once', () => {
  const calls: string[] = []
  const Base = types.model('Base', {}).actions(() => ({
    afterAttach() {
      calls.push('base')
    },
  }))
  const Sub = types.compose('Sub', Base, types.model({})).actions(() => ({
    afterAttach() {
      calls.push('sub')
    },
  }))

  runAttach(Sub)
  expect(calls).toEqual(['base', 'sub'])
})

test('explicit super-capture DOUBLE-runs the base (the anti-pattern to avoid)', () => {
  const calls: string[] = []
  const Base = types.model('Base', {}).actions(() => ({
    afterAttach() {
      calls.push('base')
    },
  }))
  const Sub = types.compose('Sub', Base, types.model({})).actions(self => {
    const superAfterAttach = self.afterAttach
    return {
      afterAttach() {
        superAfterAttach()
        calls.push('sub')
      },
    }
  })

  runAttach(Sub)
  // base runs twice: once via the fork's auto-chain, once via the explicit call
  expect(calls).toEqual(['base', 'base', 'sub'])
})
