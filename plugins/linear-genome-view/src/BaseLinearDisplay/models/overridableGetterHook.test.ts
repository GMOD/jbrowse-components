import { types } from '@jbrowse/mobx-state-tree'

// MultiRegionDisplayMixin exposes overridable *getter* hooks with base defaults
// that a subclass is expected to replace: `svgReadyExtraTerminal` (default
// false, sequence overrides it) and `layoutReady` (default false, alignments and
// canvas override it). Unlike the action hooks, nothing about a getter override
// is enforced by the type system — a base default and a subclass getter are both
// just properties, so if composition order ever stopped favoring the subclass
// the base's value would win SILENTLY.
//
// That failure is severe enough to pin: `layoutReady` gates the canvas display's
// own layout getters, so a base `false` winning would make it lay out nothing at
// all, and would make BreakpointSplitView drop every overlay curve. Both read as
// "no data" rather than as an error.
describe('overridable getter hooks', () => {
  const Base = types
    .model('Base', {})
    .views(() => ({
      get layoutReady(): boolean {
        return false
      },
    }))
    .views(self => ({
      // a base-side consumer, resolved through `self` like the real getters
      get consumesHook() {
        return self.layoutReady
      },
    }))

  test('a subclass getter defined after composition wins', () => {
    const Sub = types
      .compose('Sub', Base, types.model({ hasData: types.boolean }))
      .views(self => ({
        get layoutReady() {
          return self.hasData
        },
      }))

    expect(Sub.create({ hasData: true }).layoutReady).toBe(true)
    expect(Sub.create({ hasData: false }).layoutReady).toBe(false)
  })

  test('a base-side consumer resolves the subclass override, not the default', () => {
    const Sub = types
      .compose('Sub', Base, types.model({ hasData: types.boolean }))
      .views(self => ({
        get layoutReady() {
          return self.hasData
        },
      }))

    // The load-bearing half: the base's own getters must see the override too,
    // else a mixin's default silently governs the subclass's behavior.
    expect(Sub.create({ hasData: true }).consumesHook).toBe(true)
  })

  test('without an override the base default governs', () => {
    const Sub = types.compose('Sub', Base, types.model({}))

    expect(Sub.create({}).layoutReady).toBe(false)
  })
})
