import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import {
  applyPromotableDefault,
  areSlotsAtSessionDefault,
  clearPinsToInherit,
  getConfResolved,
  isPromotableDefault,
  isSlotPinned,
  makeCurrentValueSessionDefaultControl,
  resolvePromotableConfigSnapshot,
  setSlotsSessionDefault,
  tracksDifferingFrom,
} from './promotableDefaults.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

// Minimal session + display shim (see configurationSchema.test.ts's
// "ConfigurationReference" describe block): isSessionModel only needs
// `rpcManager` + `configuration`; promotableDefaults reads/writes
// get/setDisplayTypeDefault off that session ancestor.
function createDisplay(
  configSchema: ReturnType<typeof ConfigurationSchema>,
  displayConfig: Record<string, unknown> = {},
) {
  const Display = types.model('TestDisplay', {
    type: types.literal('TestDisplay'),
    configuration: configSchema,
  })
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
    }))
  const session = Session.create(
    { display: { type: 'TestDisplay', configuration: displayConfig } },
    { pluginManager },
  )
  return { session, display: session.display }
}

// Session holding several sibling displays of one type, so clearPinsToInherit
// (the "apply a promoted default to the tracks that pin their own value" sweep)
// can be exercised over a real sibling set.
function createDisplays(
  configSchema: ReturnType<typeof ConfigurationSchema>,
  displayConfigs: Record<string, unknown>[],
) {
  const Display = types.model('TestDisplay', {
    type: types.literal('TestDisplay'),
    configuration: configSchema,
  })
  const Session = types
    .model('TestSession', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      displayTypeDefaults: types.frozen<Record<string, Record<string, unknown>>>(
        {},
      ),
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

  test('clears a track pinned to a different value so it inherits the default', () => {
    const { session, displays } = createDisplays(configSchema, [
      { customHeight: 10 }, // self: pinned the value being promoted
      { customHeight: 20 }, // pinned a different value
    ])
    const other = displays[1]!
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 10)

    expect(isSlotPinned(other, 'customHeight')).toBe(true)
    clearPinsToInherit(displays, ['customHeight'])
    expect(isSlotPinned(other, 'customHeight')).toBe(false)
    expect(getConfResolved(other, 'customHeight')).toBe(10)
  })

  test('leaves an already-inheriting track untouched', () => {
    const { session, displays } = createDisplays(configSchema, [
      { customHeight: 10 },
      {}, // un-pinned -> already inherits
    ])
    const other = displays[1]!
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 10)

    clearPinsToInherit(displays, ['customHeight'])
    expect(isSlotPinned(other, 'customHeight')).toBe(false)
    expect(getConfResolved(other, 'customHeight')).toBe(10)
  })

  // Session shaped as the real one is (isViewContainer + tracks-with-displays),
  // so the dialog helpers exercise the full path across EVERY open view.
  function createViews(displayConfigsPerView: Record<string, unknown>[][]) {
    const Display = types.model('TestDisplay', {
      type: types.literal('TestDisplay'),
      configuration: configSchema,
    })
    const Track = types.model('TestTrack', { displays: types.array(Display) })
    const View = types.model('TestView', { tracks: types.array(Track) })
    const Session = types
      .model('TestSession', {
        rpcManager: types.frozen({}),
        configuration: types.frozen({}),
        displayTypeDefaults:
          types.frozen<Record<string, Record<string, unknown>>>({}),
        views: types.array(View),
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

    makeCurrentValueSessionDefaultControl(self, ['customHeight']).toggle()

    // setting the default doesn't touch the customized track in the other view
    expect(isSlotPinned(otherView, 'customHeight')).toBe(true)
    expect(getConfResolved(otherView, 'customHeight')).toBe(20)
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

  test('applyPromotableDefault (future+open) sets the default and un-pins differing tracks', () => {
    const { displayOf } = createViews([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const self = displayOf(0, 0)
    const otherView = displayOf(1, 0)
    const entries = [{ slot: 'customHeight', value: 10 }]

    applyPromotableDefault(self, entries, { future: true, openTracks: true })

    expect(isPromotableDefault(self, entries)).toBe(true)
    // the customized track in the other view is un-pinned and inherits the default
    expect(isSlotPinned(otherView, 'customHeight')).toBe(false)
    expect(getConfResolved(otherView, 'customHeight')).toBe(10)
  })

  test('applyPromotableDefault (open only) writes the value without a persistent default', () => {
    const { displayOf } = createViews([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const self = displayOf(0, 0)
    const otherView = displayOf(1, 0)
    const entries = [{ slot: 'customHeight', value: 10 }]

    applyPromotableDefault(self, entries, { future: false, openTracks: true })

    // no session default set, but open tracks were written to the value directly
    expect(isPromotableDefault(self, entries)).toBe(false)
    expect(getConfResolved(otherView, 'customHeight')).toBe(10)
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

  test('an un-pinned track follows a numeric session-wide default', () => {
    const { session, display } = createDisplay(configSchema)
    expect(getConfResolved(display, 'customHeight')).toBeUndefined()

    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 42)
    expect(getConfResolved(display, 'customHeight')).toBe(42)
  })

  test('an explicit per-track value pins over the session default', () => {
    const { session, display } = createDisplay(configSchema, {
      customHeight: 10,
    })
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 42)
    expect(isSlotPinned(display, 'customHeight')).toBe(true)
    expect(getConfResolved(display, 'customHeight')).toBe(10)
  })

  test('ignores a non-numeric session default instead of rejecting every value', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 'tall')
    expect(getConfResolved(display, 'customHeight')).toBeUndefined()
  })
})

// A promotable `maybeBoolean` slot: its `undefined` default is the "unset —
// inherit" sentinel, so BOTH `true` and `false` stay pinnable over an opposite
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

  test('an un-pinned track resolves to promotedBase, never undefined', () => {
    const { display } = createDisplay(configSchema)
    expect(getConfResolved(display, 'chevrons')).toBe(true)
    expect(isSlotPinned(display, 'chevrons')).toBe(false)
  })

  test('an un-pinned track follows an off session default', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', false)
    expect(getConfResolved(display, 'chevrons')).toBe(false)
  })

  test('a track can pin ON over an OFF session default (the symmetry win)', () => {
    const { session, display } = createDisplay(configSchema, { chevrons: true })
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', false)
    expect(isSlotPinned(display, 'chevrons')).toBe(true)
    expect(getConfResolved(display, 'chevrons')).toBe(true)
  })

  test('a track can pin OFF over an ON session default', () => {
    const { session, display } = createDisplay(configSchema, {
      chevrons: false,
    })
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', true)
    expect(isSlotPinned(display, 'chevrons')).toBe(true)
    expect(getConfResolved(display, 'chevrons')).toBe(false)
  })

  test('setSlotsSessionDefault promotes and clears the current resolved value', () => {
    const { session, display } = createDisplay(configSchema, {
      chevrons: false,
    })
    setSlotsSessionDefault(display, ['chevrons'], true)
    expect(session.getDisplayTypeDefault('TestDisplay', 'chevrons')).toBe(false)
    expect(areSlotsAtSessionDefault(display, ['chevrons'])).toBe(true)

    setSlotsSessionDefault(display, ['chevrons'], false)
    expect(
      session.getDisplayTypeDefault('TestDisplay', 'chevrons'),
    ).toBeUndefined()
  })

  test('ignores a non-boolean session default instead of rejecting every value', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', 'yes')
    expect(getConfResolved(display, 'chevrons')).toBe(true)
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

  test('keeps a pinned promotable value over the session default', () => {
    const { session, display } = createDisplay(configSchema, { chevrons: true })
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', false)
    expect(resolvePromotableConfigSnapshot(display).chevrons).toBe(true)
  })
})

// A frozen (object-valued) promotable slot's equality must be structural, not
// key-order-sensitive: a promoted default and a track's own pinned value can be
// built by different code paths and still land with keys in a different order.
describe('promotable frozen slot structural equality', () => {
  const configSchema = ConfigurationSchema('ColorByDisplay', {
    colorBy: {
      type: 'frozen',
      defaultValue: { type: 'normal' },
      promotable: true,
    },
  })

  test('recognizes a pinned value as the session default regardless of key order', () => {
    const { session, display } = createDisplay(configSchema, {
      // keys in the opposite order from how the default will be promoted below
      colorBy: { tag: 'XT', type: 'tag' },
    })
    session.setDisplayTypeDefault('TestDisplay', 'colorBy', {
      type: 'tag',
      tag: 'XT',
    })
    expect(areSlotsAtSessionDefault(display, ['colorBy'])).toBe(true)
  })

  test('setSlotsSessionDefault promotes and clears a structurally-equal value', () => {
    const { session, display } = createDisplay(configSchema, {
      colorBy: { tag: 'XT', type: 'tag' },
    })
    setSlotsSessionDefault(display, ['colorBy'], true)
    expect(session.getDisplayTypeDefault('TestDisplay', 'colorBy')).toEqual({
      tag: 'XT',
      type: 'tag',
    })
    expect(areSlotsAtSessionDefault(display, ['colorBy'])).toBe(true)

    setSlotsSessionDefault(display, ['colorBy'], false)
    expect(
      session.getDisplayTypeDefault('TestDisplay', 'colorBy'),
    ).toBeUndefined()
  })

  test('a malformed own value of the wrong JS shape degrades to the base', () => {
    // a frozen slot accepts any JSON, so a corrupt saved snapshot could pin a
    // string where an object is expected — the shape gate alone (no validate
    // hook here) treats it as un-pinned so it falls back rather than flowing on
    const { display } = createDisplay(configSchema, {
      colorBy: 'not-an-object',
    })
    expect(isSlotPinned(display, 'colorBy')).toBe(false)
    expect(getConfResolved(display, 'colorBy')).toEqual({ type: 'normal' })
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
    expect(getConfResolved(display, 'colorBy')).toEqual({ type: 'strand' })
  })

  test('rejects a structurally-fine but unregistered value instead of passing it through', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'colorBy', {
      type: 'a-removed-scheme',
    })
    // falls back to base rather than handing a consumer an unrecognized type
    expect(getConfResolved(display, 'colorBy')).toEqual({ type: 'normal' })
  })

  test("a track's own pinned value that fails validate degrades to the base", () => {
    // a saved session pinned a scheme that's since been removed — the same
    // stale-name hazard as a promoted default, but on the track's own value
    const { display } = createDisplay(configSchema, {
      colorBy: { type: 'a-removed-scheme' },
    })
    // an unusable pin reads as un-pinned so every consumer falls back in lockstep
    expect(isSlotPinned(display, 'colorBy')).toBe(false)
    expect(getConfResolved(display, 'colorBy')).toEqual({ type: 'normal' })
  })

  test("a track's own pinned value that fails validate still follows a usable session default", () => {
    const { session, display } = createDisplay(configSchema, {
      colorBy: { type: 'a-removed-scheme' },
    })
    session.setDisplayTypeDefault('TestDisplay', 'colorBy', { type: 'strand' })
    // un-pinned by the failed validate, so it inherits the promoted default
    expect(getConfResolved(display, 'colorBy')).toEqual({ type: 'strand' })
  })
})

// A sentinel slot's `defaultValue` is a dedicated `'inherit'` member (the "no
// value — inherit" signal) and `promotedBase` is what it resolves to, so — unlike
// a plain slot — every real value including `promotedBase` stays pinnable over an
// opposite session default. Exercises `isConcreteValue`'s sentinel branch and
// that `getConfResolved` never surfaces the `'inherit'` member.
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

  test('an un-pinned track resolves to promotedBase, never the inherit sentinel', () => {
    const { display } = createDisplay(configSchema)
    expect(getConfResolved(display, 'mode')).toBe('normal')
    expect(isSlotPinned(display, 'mode')).toBe(false)
  })

  test('an un-pinned track follows a usable session default', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'compact')
    expect(getConfResolved(display, 'mode')).toBe('compact')
  })

  test('a track can pin promotedBase over an opposite session default', () => {
    const { session, display } = createDisplay(configSchema, { mode: 'normal' })
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'compact')
    expect(isSlotPinned(display, 'mode')).toBe(true)
    expect(getConfResolved(display, 'mode')).toBe('normal')
  })

  test('a promoted inherit sentinel is rejected and falls back to promotedBase', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'inherit')
    expect(getConfResolved(display, 'mode')).toBe('normal')
  })

  test('a promoted non-enum value is rejected and falls back to promotedBase', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'bogus')
    expect(getConfResolved(display, 'mode')).toBe('normal')
  })
})
