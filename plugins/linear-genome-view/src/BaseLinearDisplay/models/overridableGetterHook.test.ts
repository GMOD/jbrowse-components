import { types } from '@jbrowse/mobx-state-tree'
import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'

// MultiRegionDisplayMixin exposes overridable *getter* hooks with base defaults
// that a subclass is expected to replace: `fetchInert` (default false, sequence
// and LD override it) and `layoutReady` (default false, alignments and canvas
// override it). Unlike the action hooks, nothing about a getter override
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

// `fetchInert` is the same mechanism carrying the `displayPhase` loading
// term, and it exists because the alternative — overriding `displayPhase`
// itself — means restating every term the base ORs together. Sequence held such
// a copy; the day the base grows a fourth term, the copy is wrong and nothing
// says so. This models the real shape: a base phase getter built from the
// production `computeDisplayPhase` over a hook a subclass replaces.
describe('fetchInert drives displayPhase without a getter override', () => {
  const PhaseBase = types
    .model('PhaseBase', { fetching: types.boolean })
    .views(() => ({
      get fetchInert(): boolean {
        return false
      },
    }))
    .views(self => ({
      get displayPhase() {
        return computeDisplayPhase(
          { renderError: undefined, regionTooLarge: false, error: undefined },
          () => !self.fetchInert && self.fetching,
        )
      },
    }))

  test('without an override a fetch shows the loading phase', () => {
    expect(PhaseBase.create({ fetching: true }).displayPhase).toBe('loading')
  })

  test('a subclass suppressing it falls through to ready, so its own static message shows', () => {
    const ZoomedOut = types
      .compose('ZoomedOut', PhaseBase, types.model({}))
      .views(() => ({
        get fetchInert() {
          return true
        },
      }))

    expect(ZoomedOut.create({ fetching: true }).displayPhase).toBe('ready')
  })
})
