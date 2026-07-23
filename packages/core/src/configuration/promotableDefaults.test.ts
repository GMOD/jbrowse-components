import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { getConf } from './getConf.ts'
import {
  getDisplayTypeDefaultChanges,
  isPromotableDefault,
  isSlotCustomized,
  makeCurrentValueDisplayTypeDefaultControl,
  makeSlotsValueDisplayTypeDefaultControl,
  resetSlotsToInherit,
  resolvePromotableConfigSnapshot,
  tracksDifferingFrom,
} from './promotableDefaults.ts'
import { readConfObject } from './util.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

// The display shim the cascade operates on: the `type` + `configuration` it
// reads, plus the received-session opt-out (`ignorePromotedDefaults`) that
// BaseDisplay contributes to every real display.
function testDisplayModel(
  configSchema: ReturnType<typeof ConfigurationSchema>,
) {
  return types
    .model('TestDisplay', {
      type: types.literal('TestDisplay'),
      configuration: configSchema,
      ignorePromotedDefaults: types.optional(types.boolean, false),
    })
    .actions(self => ({
      setIgnorePromotedDefaults(flag: boolean) {
        self.ignorePromotedDefaults = flag
      },
    }))
}

// Minimal session + display shim (see configurationSchema.test.ts's
// "ConfigurationReference" describe block): isSessionModel only needs
// `rpcManager` + `configuration`; promotableDefaults reads/writes
// get/setDisplayTypeDefault off that session ancestor.
function createDisplay(
  configSchema: ReturnType<typeof ConfigurationSchema>,
  displayConfig: Record<string, unknown> = {},
) {
  const Display = testDisplayModel(configSchema)
  const Session = types
    .model('TestSession', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      displayTypeDefaults: types.frozen<
        Record<string, Record<string, unknown>>
      >({}),
      display: Display,
    })
    .views(self => ({
      getDisplayTypeDefault(displayType: string, slot: string): unknown {
        return self.displayTypeDefaults[displayType]?.[slot]
      },
    }))
    .actions(self => ({
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        const forType = { ...self.displayTypeDefaults[displayType] }
        if (value === undefined) {
          delete forType[slot]
        } else {
          forType[slot] = value
        }
        self.displayTypeDefaults = {
          ...self.displayTypeDefaults,
          [displayType]: forType,
        }
      },
      // present so applyDefaultToggle's session.notify(...) doesn't throw
      notify() {},
    }))
  const session = Session.create(
    { display: { type: 'TestDisplay', configuration: displayConfig } },
    { pluginManager },
  )
  return { session, display: session.display }
}

// Session holding several sibling displays of one type, so resetSlotsToInherit
// (what the snackbar's "apply to open tracks" action runs) can be exercised over
// a real sibling set.
function createDisplays(
  configSchema: ReturnType<typeof ConfigurationSchema>,
  displayConfigs: Record<string, unknown>[],
) {
  const Display = testDisplayModel(configSchema)
  const Session = types
    .model('TestSession', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      displayTypeDefaults: types.frozen<
        Record<string, Record<string, unknown>>
      >({}),
      displays: types.array(Display),
    })
    .views(self => ({
      getDisplayTypeDefault(displayType: string, slot: string): unknown {
        return self.displayTypeDefaults[displayType]?.[slot]
      },
    }))
    .actions(self => ({
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        const forType = { ...self.displayTypeDefaults[displayType] }
        if (value === undefined) {
          delete forType[slot]
        } else {
          forType[slot] = value
        }
        self.displayTypeDefaults = {
          ...self.displayTypeDefaults,
          [displayType]: forType,
        }
      },
      // present so applyDefaultToggle's session.notify(...) doesn't throw
      notify() {},
    }))
  const session = Session.create(
    {
      displays: displayConfigs.map(configuration => ({
        type: 'TestDisplay' as const,
        configuration,
      })),
    },
    { pluginManager },
  )
  return { session, displays: session.displays }
}

describe('apply a promoted default to open tracks', () => {
  const configSchema = ConfigurationSchema('SiblingDisplay', {
    customHeight: {
      type: 'maybeNumber',
      defaultValue: undefined,
      promotable: true,
    },
  })

  test('clears a track customized to a different value so it inherits the default', () => {
    const { session, displays } = createDisplays(configSchema, [
      { customHeight: 10 }, // self: customized to the value being promoted
      { customHeight: 20 }, // customized to a different value
    ])
    const other = displays[1]!
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 10)

    expect(isSlotCustomized(other, 'customHeight')).toBe(true)
    resetSlotsToInherit(displays, ['customHeight'])
    expect(isSlotCustomized(other, 'customHeight')).toBe(false)
    expect(getConf(other, 'customHeight')).toBe(10)
  })

  test('leaves an already-inheriting track untouched', () => {
    const { session, displays } = createDisplays(configSchema, [
      { customHeight: 10 },
      {}, // no own value -> already follows the default
    ])
    const other = displays[1]!
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 10)

    resetSlotsToInherit(displays, ['customHeight'])
    expect(isSlotCustomized(other, 'customHeight')).toBe(false)
    expect(getConf(other, 'customHeight')).toBe(10)
  })

  // Session shaped as the real one is (isViewContainer + tracks-with-displays),
  // so the dialog helpers exercise the full path across EVERY open view.
  function createViews(displayConfigsPerView: Record<string, unknown>[][]) {
    const Display = testDisplayModel(configSchema)
    const Track = types.model('TestTrack', { displays: types.array(Display) })
    const View = types.model('TestView', { tracks: types.array(Track) })
    const Session = types
      .model('TestSession', {
        rpcManager: types.frozen({}),
        configuration: types.frozen({}),
        displayTypeDefaults: types.frozen<
          Record<string, Record<string, unknown>>
        >({}),
        views: types.array(View),
      })
      // records the last snackbar so the "apply to open tracks" action can be
      // asserted and its onClick invoked (mirrors the real SnackbarModel path)
      .volatile(() => ({
        lastNotify: undefined as
          | { message: string; action?: { name: string; onClick: () => void } }
          | undefined,
      }))
      .views(self => ({
        getDisplayTypeDefault(displayType: string, slot: string): unknown {
          return self.displayTypeDefaults[displayType]?.[slot]
        },
      }))
      .actions(self => ({
        setDisplayTypeDefault(
          displayType: string,
          slot: string,
          value: unknown,
        ) {
          const forType = { ...self.displayTypeDefaults[displayType] }
          if (value === undefined) {
            delete forType[slot]
          } else {
            forType[slot] = value
          }
          self.displayTypeDefaults = {
            ...self.displayTypeDefaults,
            [displayType]: forType,
          }
        },
        notify(
          message: string,
          _level?: string,
          action?: { name: string; onClick: () => void },
        ) {
          self.lastNotify = { message, action }
        },
        // no-ops that just make the session shape match isViewContainer
        removeView() {},
        addView() {},
      }))
    const session = Session.create(
      {
        views: displayConfigsPerView.map(configs => ({
          tracks: configs.map(configuration => ({
            displays: [{ type: 'TestDisplay' as const, configuration }],
          })),
        })),
      },
      { pluginManager },
    )
    const displayOf = (view: number, track: number) =>
      session.views[view]!.tracks[track]!.displays[0]!
    return { session, displayOf }
  }

  test('setting the default is non-destructive: a customized track keeps its value', () => {
    // view 0 holds the track whose value becomes the default (10); view 1 holds a
    // track the user customized to a different value (20)
    const { displayOf } = createViews([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const self = displayOf(0, 0)
    const otherView = displayOf(1, 0)

    makeCurrentValueDisplayTypeDefaultControl(self, ['customHeight']).toggle()

    // setting the default doesn't touch the customized track in the other view
    expect(isSlotCustomized(otherView, 'customHeight')).toBe(true)
    expect(getConf(otherView, 'customHeight')).toBe(20)
  })

  test('tracksDifferingFrom lists open tracks across views that do not match', () => {
    const { displayOf } = createViews([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const self = displayOf(0, 0)
    const otherView = displayOf(1, 0)

    const differing = tracksDifferingFrom(self, [
      { slot: 'customHeight', value: 10 },
    ])
    expect(differing).toHaveLength(1)
    expect(differing[0]).toBe(otherView)
  })

  test('toggling the default on offers "apply to open tracks" for tracks not showing it', () => {
    const { session, displayOf } = createViews([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const self = displayOf(0, 0)
    const otherView = displayOf(1, 0)
    const entries = [{ slot: 'customHeight', value: 10 }]

    makeSlotsValueDisplayTypeDefaultControl(self, entries).toggle()

    // default set; the track with its own different value keeps it until applied
    expect(isPromotableDefault(self, entries)).toBe(true)
    expect(isSlotCustomized(otherView, 'customHeight')).toBe(true)

    // the snackbar offered "Apply to N open tracks"; running it makes the one
    // track not already showing 10 follow the new default
    const action = session.lastNotify?.action
    expect(action?.name).toBe('Apply to 1 open track')
    action!.onClick()
    expect(isSlotCustomized(otherView, 'customHeight')).toBe(false)
    expect(getConf(otherView, 'customHeight')).toBe(10)
  })

  test('toggling on applies the value to the clicked track immediately and excludes it from the snackbar', () => {
    // both open tracks are customized to a different value than the one promoted;
    // the pin was clicked from `self`, so `self` converts on the click and only
    // the *other* track is left for the snackbar
    const { session, displayOf } = createViews([
      [{ customHeight: 20 }],
      [{ customHeight: 20 }],
    ])
    const self = displayOf(0, 0)
    const otherView = displayOf(1, 0)
    const entries = [{ slot: 'customHeight', value: 10 }]

    makeSlotsValueDisplayTypeDefaultControl(self, entries).toggle()

    // the clicked track now follows the new default with no further action
    expect(isSlotCustomized(self, 'customHeight')).toBe(false)
    expect(getConf(self, 'customHeight')).toBe(10)
    // ...and the snackbar counts only the one remaining track
    expect(session.lastNotify?.action?.name).toBe('Apply to 1 open track')
    expect(isSlotCustomized(otherView, 'customHeight')).toBe(true)
  })

  test('a following track in another view picks up the new default automatically', () => {
    // view 1's track has no own value, so setting the default moves it with no
    // "apply to open tracks" click needed — that action only targets tracks that
    // aren't already showing the value
    const { session, displayOf } = createViews([[{ customHeight: 10 }], [{}]])
    const self = displayOf(0, 0)
    const follower = displayOf(1, 0)
    expect(getConf(follower, 'customHeight')).toBeUndefined()

    makeSlotsValueDisplayTypeDefaultControl(self, [
      { slot: 'customHeight', value: 10 },
    ]).toggle()

    expect(getConf(follower, 'customHeight')).toBe(10)
    expect(session.lastNotify?.action).toBeUndefined()
  })

  test('toggling on with every open track already showing it offers no action', () => {
    const { session, displayOf } = createViews([[{ customHeight: 10 }]])
    const self = displayOf(0, 0)

    makeSlotsValueDisplayTypeDefaultControl(self, [
      { slot: 'customHeight', value: 10 },
    ]).toggle()

    expect(session.lastNotify?.message).toBe('Set as the default')
    expect(session.lastNotify?.action).toBeUndefined()
  })

  test('clearing the default just notifies, leaving open tracks alone', () => {
    const { session, displayOf } = createViews([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const self = displayOf(0, 0)
    const otherView = displayOf(1, 0)
    const entries = [{ slot: 'customHeight', value: 10 }]
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 10)

    // control is active (default already 10), so toggle clears it
    makeSlotsValueDisplayTypeDefaultControl(self, entries).toggle()

    expect(isPromotableDefault(self, entries)).toBe(false)
    expect(isSlotCustomized(otherView, 'customHeight')).toBe(true)
    expect(session.lastNotify?.message).toBe('Cleared the default')
    expect(session.lastNotify?.action).toBeUndefined()
  })
})

// A promotable `maybeNumber` slot has no real `defaultValue` to type-check a
// promoted value against (its default is the "unset" sentinel `undefined`) —
// `matchesSlotShape` special-cases this to check against `number` instead.
describe('promotable maybeNumber slot', () => {
  const configSchema = ConfigurationSchema('MaybeNumberDisplay', {
    customHeight: {
      type: 'maybeNumber',
      description: 'an optional promotable height override',
      defaultValue: undefined,
      promotable: true,
    },
  })

  test('a track with no own value follows a numeric session-wide default', () => {
    const { session, display } = createDisplay(configSchema)
    expect(getConf(display, 'customHeight')).toBeUndefined()

    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 42)
    expect(getConf(display, 'customHeight')).toBe(42)
  })

  test('an explicit per-track value overrides the session default', () => {
    const { session, display } = createDisplay(configSchema, {
      customHeight: 10,
    })
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 42)
    expect(isSlotCustomized(display, 'customHeight')).toBe(true)
    expect(getConf(display, 'customHeight')).toBe(10)
  })

  test('ignores a non-numeric session default instead of rejecting every value', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 'tall')
    expect(getConf(display, 'customHeight')).toBeUndefined()
  })

  test('ignores a non-finite (NaN) session default rather than passing it on', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', NaN)
    expect(getConf(display, 'customHeight')).toBeUndefined()
  })
})

// A promotable `maybeBoolean` slot: its `undefined` default is the "unset —
// inherit" sentinel, so BOTH `true` and `false` stay customizable per-track over an opposite
// session default — the symmetry a plain boolean (whose default doubles as the
// inherit signal) can't offer. `promotedBase` supplies the value the unset
// sentinel resolves to; `matchesSlotShape` keys the shape check on the `type`.
describe('promotable maybeBoolean slot', () => {
  const configSchema = ConfigurationSchema('MaybeBooleanDisplay', {
    chevrons: {
      type: 'maybeBoolean',
      description: 'a promotable on/off setting defaulting to on',
      defaultValue: undefined,
      promotedBase: true,
      promotable: true,
    },
  })

  test('a track with no own value resolves to promotedBase, never undefined', () => {
    const { display } = createDisplay(configSchema)
    expect(getConf(display, 'chevrons')).toBe(true)
    expect(isSlotCustomized(display, 'chevrons')).toBe(false)
  })

  test('a track with no own value follows an off session default', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', false)
    expect(getConf(display, 'chevrons')).toBe(false)
  })

  test('a track can override with ON over an OFF session default (the symmetry win)', () => {
    const { session, display } = createDisplay(configSchema, { chevrons: true })
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', false)
    expect(isSlotCustomized(display, 'chevrons')).toBe(true)
    expect(getConf(display, 'chevrons')).toBe(true)
  })

  test('a track can override with OFF over an ON session default', () => {
    const { session, display } = createDisplay(configSchema, {
      chevrons: false,
    })
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', true)
    expect(isSlotCustomized(display, 'chevrons')).toBe(true)
    expect(getConf(display, 'chevrons')).toBe(false)
  })

  test('promote-current control stores the symmetric false and clears it', () => {
    const { session, display } = createDisplay(configSchema, {
      chevrons: false,
    })
    const control = makeCurrentValueDisplayTypeDefaultControl(display, [
      'chevrons',
    ])
    expect(control.active).toBe(false)
    control.toggle()
    expect(session.getDisplayTypeDefault('TestDisplay', 'chevrons')).toBe(false)
    expect(
      makeCurrentValueDisplayTypeDefaultControl(display, ['chevrons']).active,
    ).toBe(true)

    makeCurrentValueDisplayTypeDefaultControl(display, ['chevrons']).toggle()
    expect(
      session.getDisplayTypeDefault('TestDisplay', 'chevrons'),
    ).toBeUndefined()
  })

  test('ignores a non-boolean session default instead of rejecting every value', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', 'yes')
    expect(getConf(display, 'chevrons')).toBe(true)
  })
})

// A promotable `maybeColor` slot is the third `undefined`-default `maybe*` type,
// so — like maybeNumber/maybeBoolean — `matchesSlotShape` keys its shape check
// on the `type` (a string), not on the `undefined` default. Regression guard for
// the gap where a maybeColor promoted default / own value was rejected wholesale
// because the shape check demanded `typeof value === 'undefined'`.
describe('promotable maybeColor slot', () => {
  const configSchema = ConfigurationSchema('MaybeColorDisplay', {
    labelColor: {
      type: 'maybeColor',
      description: 'a promotable color that may be unset',
      defaultValue: undefined,
      promotedBase: 'black',
      promotable: true,
    },
  })

  test('a track with no own value resolves to promotedBase', () => {
    const { display } = createDisplay(configSchema)
    expect(getConf(display, 'labelColor')).toBe('black')
    expect(isSlotCustomized(display, 'labelColor')).toBe(false)
  })

  test('a track with no own value follows a color session default', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'labelColor', 'goldenrod')
    expect(getConf(display, 'labelColor')).toBe('goldenrod')
  })

  test('an explicit per-track color overrides the session default', () => {
    const { session, display } = createDisplay(configSchema, {
      labelColor: 'red',
    })
    session.setDisplayTypeDefault('TestDisplay', 'labelColor', 'goldenrod')
    expect(isSlotCustomized(display, 'labelColor')).toBe(true)
    expect(getConf(display, 'labelColor')).toBe('red')
  })

  test('ignores a non-string session default instead of rejecting every value', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'labelColor', 42)
    expect(getConf(display, 'labelColor')).toBe('black')
  })
})

// resolvePromotableConfigSnapshot is the worker-payload safety net: it hands out
// the config snapshot with every promotable slot resolved in place, so a raw
// inherit sentinel (an unset maybeBoolean here) never ships to a worker, and a
// new promotable slot needs no per-slot rpcProps bookkeeping.
describe('resolvePromotableConfigSnapshot', () => {
  const configSchema = ConfigurationSchema('SnapshotDisplay', {
    chevrons: {
      type: 'maybeBoolean',
      defaultValue: undefined,
      promotedBase: true,
      promotable: true,
    },
    // a plain non-promotable slot, to confirm it passes through untouched
    color: {
      type: 'color',
      defaultValue: 'red',
    },
  })

  test('resolves an unset promotable slot to the session default, leaves others', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', false)
    const snap = resolvePromotableConfigSnapshot(display)
    // the raw snapshot omits the unset maybeBoolean (stripDefault) — resolve
    // fills it with the concrete session-default value the worker can use
    expect(snap.chevrons).toBe(false)
    expect(snap.color).toBe('red')
  })

  test('keeps a customized promotable value over the session default', () => {
    const { session, display } = createDisplay(configSchema, { chevrons: true })
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', false)
    expect(resolvePromotableConfigSnapshot(display).chevrons).toBe(true)
  })
})

// A frozen (object-valued) promotable slot's equality must be structural, not
// key-order-sensitive: a promoted default and a track's own customized value can be
// built by different code paths and still land with keys in a different order.
describe('promotable frozen slot structural equality', () => {
  const configSchema = ConfigurationSchema('ColorByDisplay', {
    colorBy: {
      type: 'frozen',
      defaultValue: { type: 'normal' },
      promotable: true,
    },
  })

  test('recognizes a customized value as the session default regardless of key order', () => {
    const { session, display } = createDisplay(configSchema, {
      // keys in the opposite order from how the default is promoted below
      colorBy: { tag: 'XT', type: 'tag' },
    })
    session.setDisplayTypeDefault('TestDisplay', 'colorBy', {
      type: 'tag',
      tag: 'XT',
    })
    expect(
      makeCurrentValueDisplayTypeDefaultControl(display, ['colorBy']).active,
    ).toBe(true)
  })

  test('promote-current control stores and clears a structurally-equal value', () => {
    const { session, display } = createDisplay(configSchema, {
      colorBy: { tag: 'XT', type: 'tag' },
    })
    makeCurrentValueDisplayTypeDefaultControl(display, ['colorBy']).toggle()
    expect(session.getDisplayTypeDefault('TestDisplay', 'colorBy')).toEqual({
      tag: 'XT',
      type: 'tag',
    })
    expect(
      makeCurrentValueDisplayTypeDefaultControl(display, ['colorBy']).active,
    ).toBe(true)

    makeCurrentValueDisplayTypeDefaultControl(display, ['colorBy']).toggle()
    expect(
      session.getDisplayTypeDefault('TestDisplay', 'colorBy'),
    ).toBeUndefined()
  })

  test('a malformed own value of the wrong JS shape degrades to the base', () => {
    // a frozen slot accepts any JSON, so a corrupt saved snapshot could hold a
    // string where an object is expected — the shape gate alone (no validate
    // hook here) treats it as not customized so it falls back rather than flowing on
    const { display } = createDisplay(configSchema, {
      colorBy: 'not-an-object',
    })
    expect(isSlotCustomized(display, 'colorBy')).toBe(false)
    expect(getConf(display, 'colorBy')).toEqual({ type: 'normal' })
  })
})

// A slot's `validate` hook lets `isUsableValue` reject a value that's
// structurally fine (right JS type/shape) but semantically stale — e.g. a
// `colorBy.type` naming a color scheme that's since been renamed or removed —
// before it reaches a consumer that assumes every value it sees is valid.
describe('promotable slot validate hook', () => {
  const KNOWN_TYPES = new Set(['normal', 'strand'])
  const configSchema = ConfigurationSchema('ValidatedDisplay', {
    colorBy: {
      type: 'frozen',
      defaultValue: { type: 'normal' },
      promotable: true,
      validate: (value: unknown) =>
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        typeof value.type === 'string' &&
        KNOWN_TYPES.has(value.type),
    },
  })

  test('accepts a promoted value that passes validate', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'colorBy', { type: 'strand' })
    expect(getConf(display, 'colorBy')).toEqual({ type: 'strand' })
  })

  test('rejects a structurally-fine but unregistered value instead of passing it through', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'colorBy', {
      type: 'a-removed-scheme',
    })
    // falls back to base rather than handing a consumer an unrecognized type
    expect(getConf(display, 'colorBy')).toEqual({ type: 'normal' })
  })

  test("a track's own customized value that fails validate degrades to the base", () => {
    // a saved session customized to a scheme that's since been removed — the same
    // stale-name hazard as a promoted default, but on the track's own value
    const { display } = createDisplay(configSchema, {
      colorBy: { type: 'a-removed-scheme' },
    })
    // an unusable own value reads as not customized so every consumer falls back in lockstep
    expect(isSlotCustomized(display, 'colorBy')).toBe(false)
    expect(getConf(display, 'colorBy')).toEqual({ type: 'normal' })
  })

  test("a track's own customized value that fails validate still follows a usable session default", () => {
    const { session, display } = createDisplay(configSchema, {
      colorBy: { type: 'a-removed-scheme' },
    })
    session.setDisplayTypeDefault('TestDisplay', 'colorBy', { type: 'strand' })
    // treated as not customized by the failed validate, so it inherits the promoted default
    expect(getConf(display, 'colorBy')).toEqual({ type: 'strand' })
  })
})

// A sentinel slot's `defaultValue` is a dedicated `'inherit'` member (the "no
// value — inherit" signal) and `promotedBase` is what it resolves to, so — unlike
// a plain slot — every real value including `promotedBase` stays customizable per-track over an
// opposite session default. Exercises `isConcreteValue`'s sentinel branch and
// that `getConf` never surfaces the `'inherit'` member.
describe('promotable sentinel slot', () => {
  const configSchema = ConfigurationSchema('SentinelDisplay', {
    mode: {
      type: 'stringEnum',
      model: types.enumeration('Mode', ['inherit', 'normal', 'compact']),
      defaultValue: 'inherit',
      promotedBase: 'normal',
      promotable: true,
    },
  })

  test('a track with no own value resolves to promotedBase, never the inherit sentinel', () => {
    const { display } = createDisplay(configSchema)
    expect(getConf(display, 'mode')).toBe('normal')
    expect(isSlotCustomized(display, 'mode')).toBe(false)
  })

  test('a track with no own value follows a usable session default', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'compact')
    expect(getConf(display, 'mode')).toBe('compact')
  })

  test('a track can override with promotedBase over an opposite session default', () => {
    const { session, display } = createDisplay(configSchema, { mode: 'normal' })
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'compact')
    expect(isSlotCustomized(display, 'mode')).toBe(true)
    expect(getConf(display, 'mode')).toBe('normal')
  })

  test('a promoted inherit sentinel is rejected and falls back to promotedBase', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'inherit')
    expect(getConf(display, 'mode')).toBe('normal')
  })

  test('a promoted non-enum value is rejected and falls back to promotedBase', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'bogus')
    expect(getConf(display, 'mode')).toBe('normal')
  })
})

// A display that arrived in a session received from someone else opts out of
// the session-wide tier, so this browser's promoted defaults can't repaint what
// the sender saw. See BaseDisplay's `ignorePromotedDefaults` property.
describe('a display from a received session', () => {
  const sentinelSchema = ConfigurationSchema('ReceivedSentinel', {
    mode: {
      type: 'stringEnum',
      model: types.enumeration('Mode', ['inherit', 'normal', 'compact']),
      defaultValue: 'inherit',
      promotedBase: 'normal',
      promotable: true,
    },
  })
  // no promotedBase: `defaultValue` is both the base value and the inherit
  // signal, so no value written into the config can read as customized here.
  // The opt-out is the only thing that can hold this slot at the sender's value.
  const plainSchema = ConfigurationSchema('ReceivedPlain', {
    showLabels: {
      type: 'boolean',
      defaultValue: false,
      promotable: true,
    },
  })

  test('ignores a promoted default on a sentinel slot', () => {
    const { session, display } = createDisplay(sentinelSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'compact')
    expect(getConf(display, 'mode')).toBe('compact')

    display.setIgnorePromotedDefaults(true)
    expect(getConf(display, 'mode')).toBe('normal')
  })

  test('ignores a promoted default on a plain slot, which baking cannot do', () => {
    const { session, display } = createDisplay(plainSchema)
    session.setDisplayTypeDefault('TestDisplay', 'showLabels', true)
    // the sender's own value *is* the slot default, so writing it into the
    // config leaves it indistinguishable from "inherit" — the promoted true wins
    expect(getConf(display, 'showLabels')).toBe(true)

    display.setIgnorePromotedDefaults(true)
    expect(getConf(display, 'showLabels')).toBe(false)
  })

  test('keeps its own baked-in value', () => {
    const { session, display } = createDisplay(sentinelSchema, {
      mode: 'compact',
    })
    display.setIgnorePromotedDefaults(true)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'normal')
    expect(getConf(display, 'mode')).toBe('compact')
  })

  test('reports no session-default changes for the affected-by-a-default badge', () => {
    const { session, display } = createDisplay(sentinelSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'compact')
    expect(getDisplayTypeDefaultChanges(display)).toEqual([
      { path: ['mode'], from: 'normal', to: 'compact' },
    ])

    display.setIgnorePromotedDefaults(true)
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
  })

  // The opt-out neutralizes the session-wide TIER of the cascade for this
  // display; it does not un-promote the value. The pin reports on the session,
  // so it must keep reading the raw promoted default — otherwise every track in
  // a received session shows an outline pin for a value that IS the user's
  // default, and the toggle can only ever set, never clear it.
  test('still reports the session default for the pin while opted out', () => {
    const { session, display } = createDisplay(sentinelSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'compact')
    const entries = [{ slot: 'mode', value: 'compact' }]
    expect(isPromotableDefault(display, entries)).toBe(true)

    display.setIgnorePromotedDefaults(true)
    // the display no longer FOLLOWS the default...
    expect(getConf(display, 'mode')).toBe('normal')
    // ...but 'compact' is still what's promoted session-wide
    expect(isPromotableDefault(display, entries)).toBe(true)
  })

  test('follows the default once the user deliberately opts it back in', () => {
    const { session, display } = createDisplay(sentinelSchema, {
      mode: 'compact',
    })
    display.setIgnorePromotedDefaults(true)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'normal')

    resetSlotsToInherit([display], ['mode'])
    expect(display.ignorePromotedDefaults).toBe(false)
    expect(getConf(display, 'mode')).toBe('normal')
  })
})

// `getConf` resolves a promotable slot through the cascade (so a display's own
// value getter is a plain `getConf` and follows the display-type default), while
// `readConfObject` is the raw escape hatch that returns the stored value
// unresolved. The two readers on the same promotable slot are the contract.
describe('getConf resolves promotable slots; readConfObject stays raw', () => {
  const schema = ConfigurationSchema('ReaderContractDisplay', {
    guardedHeight: {
      type: 'maybeNumber',
      defaultValue: undefined,
      promotedBase: 7,
      description: 'a promotable slot resolved by getConf',
      promotable: true,
    },
    plainLabel: {
      type: 'string',
      defaultValue: 'hello',
      description: 'a plain non-promotable slot',
    },
  })

  test('getConf on an unset promotable slot returns promotedBase, not the sentinel', () => {
    const { display } = createDisplay(schema)
    // getConf walks the cascade to the concrete base; the raw read returns the
    // unset sentinel (undefined) it's stored as
    expect(getConf(display, 'guardedHeight')).toBe(7)
    expect(
      readConfObject(display.configuration, 'guardedHeight'),
    ).toBeUndefined()
  })

  test('getConf on a promotable slot follows the session-wide default', () => {
    const { session, display } = createDisplay(schema)
    session.setDisplayTypeDefault('TestDisplay', 'guardedHeight', 42)
    // getConf picks up the promoted default; readConfObject still sees no own value
    expect(getConf(display, 'guardedHeight')).toBe(42)
    expect(
      readConfObject(display.configuration, 'guardedHeight'),
    ).toBeUndefined()
  })

  test('getConf on a plain (non-promotable) slot reads straight through', () => {
    const { display } = createDisplay(schema)
    expect(getConf(display, 'plainLabel')).toBe('hello')
  })
})
