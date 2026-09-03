import {
  destroy,
  getSnapshot,
  isAlive,
  types,
  unprotect,
} from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { getConf, resolveConf, setConf } from './getConf.ts'
import {
  applySlotToOpenTracks,
  getDisplayTypeDefaultChanges,
  isPromotableDefault,
  isSlotCustomized,
  makePin,
  makeTogglePin,
  openTracksOfType,
  getConfigSnapshotWithPromotables,
} from './promotableDefaults.ts'
import { readConfObject } from './readConfObject.ts'
import { getSlotDefinition } from './slotFacade.ts'

import type { ResolvedConfigSnapshot } from './promotableDefaults.ts'
import type { ResolvableDisplay } from './promotableResolve.ts'
import type { AnyConfigurationSchemaType } from './types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

// The display shim the cascade operates on: the `type` + `configuration` it
// reads, which is the whole of `ResolvableDisplay`.
function testDisplayModel(configSchema: AnyConfigurationSchemaType) {
  return types.model('TestDisplay', {
    type: types.literal('TestDisplay'),
    configuration: configSchema,
  })
}

interface SnackActionShim {
  name: string
  onClick: () => void
}

type Notified = { message: string; actions: SnackActionShim[] } | undefined

// normalized the way the real SnackbarModel does, so a test can ask which
// actions the toast offered rather than only whether it had one
function normalizeNotify(
  message: string,
  action?: SnackActionShim | SnackActionShim[],
): Notified {
  return {
    message,
    actions: action ? (Array.isArray(action) ? action : [action]) : [],
  }
}

const actionNames = (notify: Notified) => notify?.actions.map(a => a.name)

// The toast carries one action or none, so a test can name it without indexing
// past a second that isn't there.
function soleAction(notify: Notified) {
  const [found, ...rest] = notify?.actions ?? []
  if (!found || rest.length) {
    throw new Error(
      `expected exactly one snackbar action, offered: ${JSON.stringify(actionNames(notify))}`,
    )
  }
  return found
}

// Minimal session + display shim (see configurationSchema.test.ts's
// "ConfigurationReference" describe block): isSessionModel only needs
// `rpcManager` + `configuration`; promotableDefaults reads/writes
// get/setDisplayTypeDefault off that session ancestor.
// Generic over the schema, and the returned `display` carries it: the widened
// `ReturnType<typeof ConfigurationSchema>` parameter erased the slot value
// types, so every `makePin` value below checked against `any`.
function createDisplay<SCHEMA extends AnyConfigurationSchemaType>(
  configSchema: SCHEMA,
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
    .volatile(() => ({
      lastNotify: undefined as Notified,
    }))
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
      notify(
        message: string,
        _level?: string,
        action?: SnackActionShim | SnackActionShim[],
      ) {
        self.lastNotify = normalizeNotify(message, action)
      },
    }))
  const session = Session.create(
    { display: { type: 'TestDisplay', configuration: displayConfig } },
    { pluginManager },
  )
  return {
    session,
    display: session.display as ResolvableDisplay<Instance<SCHEMA>>,
  }
}

// Session holding several sibling displays of one type, so applySlotToOpenTracks
// (what the pin's click runs) can be exercised over a real sibling set.
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
      // present so applyPinClick's session.notify(...) doesn't throw
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

describe('apply a value to open tracks', () => {
  const configSchema = ConfigurationSchema('SiblingDisplay', {
    customHeight: {
      type: 'maybeNumber',
      defaultValue: undefined,
      promotedBase: 1,
    },
  })

  // The caller supplies the display set, and a track can be closed between the
  // walk that built it and the write — MST throws on both reads and writes to a
  // destroyed node, and the `isAlive` filter is the whole defense.
  test('applying a value skips a display closed after the walk', () => {
    const { session, displays } = createDisplays(configSchema, [
      { customHeight: 10 },
      { customHeight: 20 },
    ])
    const stillOpen = displays[0]!
    const closed = displays[1]!

    unprotect(session)
    destroy(closed)
    expect(isAlive(closed)).toBe(false)

    expect(() => {
      applySlotToOpenTracks([stillOpen, closed], 'customHeight', 30)
    }).not.toThrow()
    expect(resolveConf(stillOpen, 'customHeight')).toBe(30)
  })

  test('applying a value writes a track that holds nothing of its own', () => {
    const { displays } = createDisplays(configSchema, [
      { customHeight: 10 },
      {},
    ])
    const follower = displays[1]!
    expect(isSlotCustomized(follower, 'customHeight')).toBe(false)

    applySlotToOpenTracks(displays, 'customHeight', 10)

    expect(isSlotCustomized(follower, 'customHeight')).toBe(true)
    expect(resolveConf(follower, 'customHeight')).toBe(10)
  })

  // Session shaped as the real one is (isViewContainer + tracks-with-displays),
  // so the dialog helpers exercise the full path across EVERY open view.
  function createViews(displayConfigsPerView: Record<string, unknown>[][]) {
    const Display = testDisplayModel(configSchema)
    const Track = types.model('TestTrack', { displays: types.array(Display) })
    const View = types
      .model('TestView', { tracks: types.array(Track) })
      .actions(self => ({
        // stands in for hideTrack: splicing the array destroys the MST subtree,
        // so any captured display node goes dead
        closeTrack(idx: number) {
          self.tracks.splice(idx, 1)
        },
      }))
    const Session = types
      .model('TestSession', {
        rpcManager: types.frozen({}),
        configuration: types.frozen({}),
        displayTypeDefaults: types.frozen<
          Record<string, Record<string, unknown>>
        >({}),
        views: types.array(View),
      })
      // records the last snackbar so the "Set as the default" action can be
      // asserted and its onClick invoked (mirrors the real SnackbarModel path)
      .volatile(() => ({
        lastNotify: undefined as Notified,
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
          action?: SnackActionShim | SnackActionShim[],
        ) {
          self.lastNotify = normalizeNotify(message, action)
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

  test('the pin applies the value to every open track, across views', () => {
    const { session, displayOf } = createViews([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const self = displayOf(0, 0)
    const otherView = displayOf(1, 0)

    makePin(self, 'customHeight', 10).toggle()

    expect(resolveConf(otherView, 'customHeight')).toBe(10)
    expect(session.lastNotify?.message).toBe('Applied to 2 open tracks')
  })

  test('the pin applies to the clicked track itself', () => {
    const { session, displayOf } = createViews([[{ customHeight: 20 }]])
    const self = displayOf(0, 0)

    makePin(self, 'customHeight', 10).toggle()

    expect(resolveConf(self, 'customHeight')).toBe(10)
    expect(session.lastNotify?.message).toBe('Applied to 1 open track')
  })

  // Overwriting a customized track is the same write as filling in a follower.
  // The snackbar used to carry those as two separately-labeled actions over two
  // different track sets, which drew a line the user had no reason to see.
  test('the pin overwrites a track customized to something else', () => {
    const { displayOf } = createViews([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const other = displayOf(1, 0)

    makePin(displayOf(0, 0), 'customHeight', 10).toggle()

    expect(resolveConf(other, 'customHeight')).toBe(10)
  })

  // A follower holds nothing of its own and shows the value only by way of
  // whatever default is in place, so the apply has to write it as well —
  // skipping it would leave it to move again the moment that default changed.
  test('the pin writes a follower, not only the tracks that differ', () => {
    const { displayOf } = createViews([[{ customHeight: 10 }], [{}]])
    const follower = displayOf(1, 0)
    expect(isSlotCustomized(follower, 'customHeight')).toBe(false)

    makePin(displayOf(0, 0), 'customHeight', 10).toggle()

    expect(isSlotCustomized(follower, 'customHeight')).toBe(true)
    expect(resolveConf(follower, 'customHeight')).toBe(10)
  })

  // A default outlives the tracks it was set for and governs every track of the
  // type opened later, so it is the escalation and not the click.
  test('the pin sets no default of its own', () => {
    const { session, displayOf } = createViews([[{ customHeight: 10 }], [{}]])
    const self = displayOf(0, 0)

    makePin(self, 'customHeight', 10).toggle()

    expect(isPromotableDefault(self, 'customHeight', 10)).toBe(false)
    expect(actionNames(session.lastNotify)).toEqual(['Set as the default'])
  })

  test('"Set as the default" stores the value where a later track reads it', () => {
    const { session, displayOf } = createViews([[{ customHeight: 10 }]])

    makePin(displayOf(0, 0), 'customHeight', 10).toggle()
    expect(
      session.getDisplayTypeDefault('TestDisplay', 'customHeight'),
    ).toBeUndefined()

    soleAction(session.lastNotify).onClick()
    expect(session.getDisplayTypeDefault('TestDisplay', 'customHeight')).toBe(
      10,
    )
  })

  // The promotion writes the session default and nothing else: the open tracks
  // already hold the value, and clearing them to make them follow would be a
  // second bulk write the user never asked for.
  test('"Set as the default" leaves the applied tracks holding their values', () => {
    const { session, displayOf } = createViews([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const self = displayOf(0, 0)
    const other = displayOf(1, 0)

    makePin(self, 'customHeight', 10).toggle()
    soleAction(session.lastNotify).onClick()

    expect(isPromotableDefault(self, 'customHeight', 10)).toBe(true)
    expect(isSlotCustomized(other, 'customHeight')).toBe(true)
    expect(resolveConf(other, 'customHeight')).toBe(10)
  })

  // The snackbar outlives the click that raised it, so the promotion has to
  // survive the user closing the track in between — a promoted default is keyed
  // by display type and exists to govern tracks opened LATER, so tying it to the
  // clicked display being alive discarded an explicit user action in silence.
  // The type is closed over as a string, which is why no read reaches the
  // destroyed node.
  test('"Set as the default" still promotes once the clicked track is gone', () => {
    const { session, displayOf } = createViews([
      [{ customHeight: 20 }],
      [{ customHeight: 30 }],
    ])
    const self = displayOf(0, 0)

    makePin(self, 'customHeight', 10).toggle()
    const promote = soleAction(session.lastNotify)

    session.views[0]!.closeTrack(0)

    expect(() => {
      promote.onClick()
    }).not.toThrow()
    expect(session.getDisplayTypeDefault('TestDisplay', 'customHeight')).toBe(
      10,
    )
  })

  // Clicking a filled pin means "stop governing the tracks I open later". The
  // open tracks hold their values because the user applied them, so reverting
  // them here would turn a toggle into a bulk discard (ADR-048).
  test('clicking a filled pin clears the default and touches no track', () => {
    const { session, displayOf } = createViews([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const self = displayOf(0, 0)
    const otherView = displayOf(1, 0)
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 10)

    // control is active (default already 10), so toggle clears it
    makePin(self, 'customHeight', 10).toggle()

    expect(isPromotableDefault(self, 'customHeight', 10)).toBe(false)
    expect(resolveConf(otherView, 'customHeight')).toBe(20)
    expect(session.lastNotify?.message).toBe('Cleared the default')
    expect(actionNames(session.lastNotify)).toEqual([])
  })

  // The pin is no longer symmetric, and that is the trade this design makes:
  // the first click is a bulk write, so the second can only clear the default it
  // was promoted to — never un-apply.
  test('apply, promote, then unpin leaves the open tracks holding the value', () => {
    const { session, displayOf } = createViews([[{ customHeight: 20 }]])
    const self = displayOf(0, 0)

    makePin(self, 'customHeight', 10).toggle()
    soleAction(session.lastNotify).onClick()
    makePin(self, 'customHeight', 10).toggle()

    expect(isPromotableDefault(self, 'customHeight', 10)).toBe(false)
    expect(resolveConf(self, 'customHeight')).toBe(10)
  })
})

// A promotable `maybeNumber` slot's `defaultValue` is the "unset" inherit
// sentinel, so it can't type-check a promoted value — `matchesSlotShape` keys the
// shape check on the slot `type` and the concrete `promotedBase` instead.
describe('promotable maybeNumber slot', () => {
  const configSchema = ConfigurationSchema('MaybeNumberDisplay', {
    customHeight: {
      type: 'maybeNumber',
      description: 'an optional promotable height override',
      defaultValue: undefined,
      promotedBase: 1,
    },
  })

  test('a track with no own value follows a numeric session-wide default', () => {
    const { session, display } = createDisplay(configSchema)
    expect(resolveConf(display, 'customHeight')).toBe(1)

    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 42)
    expect(resolveConf(display, 'customHeight')).toBe(42)
  })

  test('an explicit per-track value overrides the session default', () => {
    const { session, display } = createDisplay(configSchema, {
      customHeight: 10,
    })
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 42)
    expect(isSlotCustomized(display, 'customHeight')).toBe(true)
    expect(resolveConf(display, 'customHeight')).toBe(10)
  })

  test('ignores a non-numeric session default instead of rejecting every value', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', 'tall')
    expect(resolveConf(display, 'customHeight')).toBe(1)
  })

  test('ignores a non-finite (NaN) session default rather than passing it on', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'customHeight', NaN)
    expect(resolveConf(display, 'customHeight')).toBe(1)
  })
})

// A promotable `maybeBoolean` slot: its `undefined` default is the "unset —
// inherit" sentinel, so BOTH `true` and `false` stay customizable per-track over
// an opposite session default — the symmetry a plain boolean, whose default would
// have to double as the inherit signal, can't offer. That is why `promotable`
// requires a spare sentinel plus `promotedBase`.
describe('promotable maybeBoolean slot', () => {
  const configSchema = ConfigurationSchema('MaybeBooleanDisplay', {
    chevrons: {
      type: 'maybeBoolean',
      description: 'a promotable on/off setting defaulting to on',
      defaultValue: undefined,
      promotedBase: true,
    },
  })

  test('a track with no own value resolves to promotedBase, never undefined', () => {
    const { display } = createDisplay(configSchema)
    expect(resolveConf(display, 'chevrons')).toBe(true)
    expect(isSlotCustomized(display, 'chevrons')).toBe(false)
  })

  test('a track with no own value follows an off session default', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', false)
    expect(resolveConf(display, 'chevrons')).toBe(false)
  })

  test('a track can override with ON over an OFF session default (the symmetry win)', () => {
    const { session, display } = createDisplay(configSchema, { chevrons: true })
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', false)
    expect(isSlotCustomized(display, 'chevrons')).toBe(true)
    expect(resolveConf(display, 'chevrons')).toBe(true)
  })

  test('a track can override with OFF over an ON session default', () => {
    const { session, display } = createDisplay(configSchema, {
      chevrons: false,
    })
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', true)
    expect(isSlotCustomized(display, 'chevrons')).toBe(true)
    expect(resolveConf(display, 'chevrons')).toBe(false)
  })

  test('promote-current control promotes the symmetric false and clears it', () => {
    const { session, display } = createDisplay(configSchema, {
      chevrons: false,
    })
    const control = makePin(display, 'chevrons')
    expect(control.active).toBe(false)
    control.toggle()
    soleAction(session.lastNotify).onClick()
    expect(session.getDisplayTypeDefault('TestDisplay', 'chevrons')).toBe(false)
    expect(makePin(display, 'chevrons').active).toBe(true)

    makePin(display, 'chevrons').toggle()
    expect(
      session.getDisplayTypeDefault('TestDisplay', 'chevrons'),
    ).toBeUndefined()
  })

  test('ignores a non-boolean session default instead of rejecting every value', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', 'yes')
    expect(resolveConf(display, 'chevrons')).toBe(true)
  })

  test('toggle pin mirrors the row, flips it, and offers the new state', () => {
    const { session, display } = createDisplay(configSchema, {
      chevrons: false,
    })
    const pin = makeTogglePin(display, 'chevrons')
    expect(pin.active).toBe(false)
    expect(pin.onValue).toBe(true)

    pin.toggle()
    expect(resolveConf(display, 'chevrons')).toBe(true)
    expect(makeTogglePin(display, 'chevrons').active).toBe(true)
    soleAction(session.lastNotify).onClick()
    expect(session.getDisplayTypeDefault('TestDisplay', 'chevrons')).toBe(true)

    makeTogglePin(display, 'chevrons').toggle()
    expect(resolveConf(display, 'chevrons')).toBe(false)
    soleAction(session.lastNotify).onClick()
    expect(session.getDisplayTypeDefault('TestDisplay', 'chevrons')).toBe(false)
  })
})

// A promotable `maybeColor` slot is the third `undefined`-default `maybe*` type.
// Regression guard for the gap where a maybeColor promoted default / own value was
// rejected wholesale because the shape check keyed off the `undefined`
// `defaultValue` and so demanded `typeof value === 'undefined'`; it now keys off
// the concrete `promotedBase`.
describe('promotable maybeColor slot', () => {
  const configSchema = ConfigurationSchema('MaybeColorDisplay', {
    labelColor: {
      type: 'maybeColor',
      description: 'a promotable color that may be unset',
      defaultValue: undefined,
      promotedBase: 'black',
    },
  })

  test('a track with no own value resolves to promotedBase', () => {
    const { display } = createDisplay(configSchema)
    expect(resolveConf(display, 'labelColor')).toBe('black')
    expect(isSlotCustomized(display, 'labelColor')).toBe(false)
  })

  test('a track with no own value follows a color session default', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'labelColor', 'goldenrod')
    expect(resolveConf(display, 'labelColor')).toBe('goldenrod')
  })

  test('an explicit per-track color overrides the session default', () => {
    const { session, display } = createDisplay(configSchema, {
      labelColor: 'red',
    })
    session.setDisplayTypeDefault('TestDisplay', 'labelColor', 'goldenrod')
    expect(isSlotCustomized(display, 'labelColor')).toBe(true)
    expect(resolveConf(display, 'labelColor')).toBe('red')
  })

  test('ignores a non-string session default instead of rejecting every value', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'labelColor', 42)
    expect(resolveConf(display, 'labelColor')).toBe('black')
  })
})

// getConfigSnapshotWithPromotables is the worker-payload safety net: it hands out
// the config snapshot with every promotable slot resolved in place, so a raw
// inherit sentinel (an unset maybeBoolean here) never ships to a worker, and a
// new promotable slot needs no per-slot rpcProps bookkeeping.
describe('getConfigSnapshotWithPromotables', () => {
  const configSchema = ConfigurationSchema('SnapshotDisplay', {
    chevrons: {
      type: 'maybeBoolean',
      defaultValue: undefined,
      promotedBase: true,
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
    const snap = getConfigSnapshotWithPromotables(display)
    // the raw snapshot omits the unset maybeBoolean (stripDefault) — resolve
    // fills it with the concrete session-default value the worker can use
    expect(snap.chevrons).toBe(false)
    expect(snap.color).toBe('red')
  })

  test('keeps a customized promotable value over the session default', () => {
    const { session, display } = createDisplay(configSchema, { chevrons: true })
    session.setDisplayTypeDefault('TestDisplay', 'chevrons', false)
    expect(getConfigSnapshotWithPromotables(display).chevrons).toBe(true)
  })

  // The brand, and the only thing that can hold it: a payload builder demanding
  // `ResolvedConfigSnapshot` must refuse a raw one.
  //
  // Everything past this function is an erased container — a snapshot is
  // `Record<string, unknown>`, and the RPC payload it becomes is an
  // `as`-asserted interface — so `getSnapshot(self.configuration)` in place of
  // this call typechecked, passed `plugins/canvas` and `products/jbrowse-web`
  // whole, and sent the worker `undefined` for every promotable slot while
  // typing it as the resolved value. `@ts-expect-error` is what fails if the
  // brand is ever loosened, since a `describe` block cannot assert at runtime
  // about a type.
  test('a raw snapshot is not a resolved one', () => {
    const { display } = createDisplay(configSchema)
    const resolved: ResolvedConfigSnapshot =
      getConfigSnapshotWithPromotables(display)
    const raw: Record<string, unknown> = getSnapshot(display.configuration)
    // @ts-expect-error a raw snapshot has not been through the cascade
    const refused: ResolvedConfigSnapshot = raw
    expect(resolved.chevrons).toBe(true)
    expect(refused.chevrons).toBeUndefined()
  })
})

// A frozen (object-valued) promotable slot's equality must be structural, not
// key-order-sensitive: a promoted default and a track's own customized value can be
// built by different code paths and still land with keys in a different order.
describe('promotable frozen slot structural equality', () => {
  const configSchema = ConfigurationSchema('ColorByDisplay', {
    colorBy: {
      type: 'maybeFrozen',
      defaultValue: undefined,
      promotedBase: { type: 'normal' },
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
    expect(makePin(display, 'colorBy').active).toBe(true)
  })

  test('promote-current control promotes and clears a structurally-equal value', () => {
    const { session, display } = createDisplay(configSchema, {
      colorBy: { tag: 'XT', type: 'tag' },
    })
    makePin(display, 'colorBy').toggle()
    soleAction(session.lastNotify).onClick()
    expect(session.getDisplayTypeDefault('TestDisplay', 'colorBy')).toEqual({
      tag: 'XT',
      type: 'tag',
    })
    expect(makePin(display, 'colorBy').active).toBe(true)

    makePin(display, 'colorBy').toggle()
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
    expect(resolveConf(display, 'colorBy')).toEqual({ type: 'normal' })
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
      type: 'maybeFrozen',
      defaultValue: undefined,
      promotedBase: { type: 'normal' },
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
    expect(resolveConf(display, 'colorBy')).toEqual({ type: 'strand' })
  })

  test('rejects a structurally-fine but unregistered value instead of passing it through', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'colorBy', {
      type: 'a-removed-scheme',
    })
    // falls back to base rather than handing a consumer an unrecognized type
    expect(resolveConf(display, 'colorBy')).toEqual({ type: 'normal' })
  })

  test("a track's own customized value that fails validate degrades to the base", () => {
    // a saved session customized to a scheme that's since been removed — the same
    // stale-name hazard as a promoted default, but on the track's own value
    const { display } = createDisplay(configSchema, {
      colorBy: { type: 'a-removed-scheme' },
    })
    // an unusable own value reads as not customized so every consumer falls back in lockstep
    expect(isSlotCustomized(display, 'colorBy')).toBe(false)
    expect(resolveConf(display, 'colorBy')).toEqual({ type: 'normal' })
  })

  test("a track's own customized value that fails validate still follows a usable session default", () => {
    const { session, display } = createDisplay(configSchema, {
      colorBy: { type: 'a-removed-scheme' },
    })
    session.setDisplayTypeDefault('TestDisplay', 'colorBy', { type: 'strand' })
    // treated as not customized by the failed validate, so it inherits the promoted default
    expect(resolveConf(display, 'colorBy')).toEqual({ type: 'strand' })
  })
})

// The enum form of the inherit sentinel: the slot is a `maybeStringEnum`, so
// being unset is the sentinel and `promotedBase` is what it resolves to. Every
// real value including `promotedBase` therefore stays customizable per-track
// over an opposite session default, and the enumeration itself lists only the
// real modes — nothing named `inherit` can reach a menu or the config editor.
describe('promotable sentinel slot', () => {
  const configSchema = ConfigurationSchema('SentinelDisplay', {
    mode: {
      type: 'maybeStringEnum',
      model: types.enumeration('Mode', ['normal', 'compact']),
      defaultValue: undefined,
      promotedBase: 'normal',
    },
  })

  test('a track with no own value resolves to promotedBase, never the inherit sentinel', () => {
    const { display } = createDisplay(configSchema)
    expect(resolveConf(display, 'mode')).toBe('normal')
    expect(isSlotCustomized(display, 'mode')).toBe(false)
  })

  test('a track with no own value follows a usable session default', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'compact')
    expect(resolveConf(display, 'mode')).toBe('compact')
  })

  test('a track can override with promotedBase over an opposite session default', () => {
    const { session, display } = createDisplay(configSchema, { mode: 'normal' })
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'compact')
    expect(isSlotCustomized(display, 'mode')).toBe(true)
    expect(resolveConf(display, 'mode')).toBe('normal')
  })

  test('a promoted "inherit" string is rejected and falls back to promotedBase', () => {
    // not a member of the enumeration any more, so it can't round-trip through
    // the untyped preference store either
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'inherit')
    expect(resolveConf(display, 'mode')).toBe('normal')
  })

  test('a promoted non-enum value is rejected and falls back to promotedBase', () => {
    const { session, display } = createDisplay(configSchema)
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'bogus')
    expect(resolveConf(display, 'mode')).toBe('normal')
  })
})

// The property that makes the share/export bake self-sufficient, and the reason
// a received display needs no opt-out flag: a baked value is written into the
// track's config, so it reads as *customized*, and a customized value wins over
// the session tier unconditionally. The recipient's own promoted default is never
// consulted for a slot the sender had a value for.
//
// The uncovered case — sender at `base`, recipient has promoted something — is
// asserted end-to-end in jbrowse-web's ShareablePromotedDefaults.test.ts, since
// only there is there a real snapshot to bake.
describe('a baked value beats the reader’s own promoted default', () => {
  const sentinelSchema = ConfigurationSchema('ReceivedSentinel', {
    mode: {
      type: 'maybeStringEnum',
      model: types.enumeration('Mode', ['normal', 'compact']),
      defaultValue: undefined,
      promotedBase: 'normal',
    },
  })

  test('keeps its own baked-in value', () => {
    const { session, display } = createDisplay(sentinelSchema, {
      mode: 'compact',
    })
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'normal')
    expect(resolveConf(display, 'mode')).toBe('compact')
  })

  // clearing the baked value is how the recipient deliberately rejoins the
  // cascade — the whole of what lifting the old opt-out flag used to also do
  test('rejoins the cascade once the baked value is cleared', () => {
    const { session, display } = createDisplay(sentinelSchema, {
      mode: 'compact',
    })
    session.setDisplayTypeDefault('TestDisplay', 'mode', 'normal')

    setConf(display, 'mode', undefined)
    expect(resolveConf(display, 'mode')).toBe('normal')
  })
})

// The three readers on one promotable slot, which together ARE the contract:
// `resolveConf` walks the cascade, `getConf` is sugar for the `.configuration`
// hop and stays raw, and `readConfObject` is the same raw read from a bare
// config. Only the first consults the session.
describe('resolveConf cascades; getConf and readConfObject stay raw', () => {
  const schema = ConfigurationSchema('ReaderContractDisplay', {
    guardedHeight: {
      type: 'maybeNumber',
      defaultValue: undefined,
      promotedBase: 7,
      description: 'a promotable slot resolved by getConf',
    },
    plainLabel: {
      type: 'string',
      defaultValue: 'hello',
      description: 'a plain non-promotable slot',
    },
  })

  test('resolveConf on an unset promotable slot returns promotedBase', () => {
    const { display } = createDisplay(schema)
    // the cascade walks to the concrete base; both raw readers return the unset
    // sentinel (undefined) the slot is actually stored as
    expect(resolveConf(display, 'guardedHeight')).toBe(7)
    expect(getConf(display, 'guardedHeight')).toBeUndefined()
    expect(
      readConfObject(display.configuration, 'guardedHeight'),
    ).toBeUndefined()
  })

  test('resolveConf on a promotable slot follows the session-wide default', () => {
    const { session, display } = createDisplay(schema)
    session.setDisplayTypeDefault('TestDisplay', 'guardedHeight', 42)
    // resolveConf picks up the promoted default; the raw readers see no own value
    expect(resolveConf(display, 'guardedHeight')).toBe(42)
    expect(getConf(display, 'guardedHeight')).toBeUndefined()
  })

  test("getConf is exactly readConfObject on the model's configuration", () => {
    const { display } = createDisplay(schema, { guardedHeight: 5 })
    expect(getConf(display, 'guardedHeight')).toBe(5)
    expect(getConf(display, 'plainLabel')).toBe('hello')
    expect(readConfObject(display.configuration, 'plainLabel')).toBe('hello')
  })

  test('resolveConf refuses a plain (non-promotable) slot', () => {
    const { display } = createDisplay(schema)
    expect(() => resolveConf(display, 'plainLabel')).toThrow(/not promotable/)
  })
})

// A promotable slot cannot hold a `jexl:` callback: the config editor's callback
// toggle needs `contextVariable` and no promotable slot declares one, because a
// promoted default is one value shared by every track of a type — the opposite of
// a per-feature expression. A hand-edited config that puts one there degrades
// like any other unusable value rather than reaching a consumer that trusts it.
describe('promotable slot holding a stray jexl callback', () => {
  const schema = ConfigurationSchema('CallbackDisplay', {
    height: {
      type: 'maybeNumber',
      defaultValue: undefined,
      promotedBase: 7,
      description: 'a promotable slot with a hand-edited callback in it',
    },
  })

  test('reads as not customized, so it follows the cascade', () => {
    const { session, display } = createDisplay(schema, {
      height: 'jexl:get(feature,"h")',
    })
    // no feature context anywhere in these consumers — none is needed
    expect(isSlotCustomized(display, 'height')).toBe(false)
    expect(resolveConf(display, 'height')).toBe(7)

    session.setDisplayTypeDefault('TestDisplay', 'height', 3)
    expect(resolveConf(display, 'height')).toBe(3)
    expect(getDisplayTypeDefaultChanges(display)).toEqual([
      { path: ['height'], from: 7, to: 3 },
    ])
  })

  test('the promote-current pin promotes the resolved value, not the callback', () => {
    const { session, display } = createDisplay(schema, {
      height: 'jexl:get(feature,"h")',
    })
    // this used to evaluate `get(feature,...)` against nothing and throw out of
    // the whole menu, then disabled itself to avoid that
    makePin(display, 'height').toggle()
    soleAction(session.lastNotify).onClick()
    expect(session.getDisplayTypeDefault('TestDisplay', 'height')).toBe(7)
  })

  // The apply asks "is this already what we would write?" of the *stored*
  // value, which a `jexl:` slot has to answer without being evaluated — this
  // caller has no feature context to evaluate it against.
  test('the apply compares the stored callback rather than evaluating it', () => {
    const { display } = createDisplay(schema, {
      height: 'jexl:get(feature,"h")',
    })
    applySlotToOpenTracks([display], 'height', 3)
    expect(getConf(display, 'height')).toBe(3)
    expect(resolveConf(display, 'height')).toBe(3)
  })
})

// Naming a real-but-plain slot in a control builder wrote a promoted default
// nothing ever read back, because every tier of the cascade needs `promotedBase`.
test('resolving a non-promotable slot throws instead of silently collapsing', () => {
  const schema = ConfigurationSchema('PlainDisplay', {
    plainLabel: {
      type: 'string',
      defaultValue: 'hello',
      description: 'an ordinary slot',
    },
  })
  const { display } = createDisplay(schema)
  expect(() => isSlotCustomized(display, 'plainLabel')).toThrow(
    /not promotable/,
  )
})

// A pin over a value the cascade would refuse is inert AND silent: toggling it
// writes a store key `resolveSlotIn` then drops, so no track moves, and
// `isPromotableDefault` compares the raw stored value, so the pin's own
// filled/outline state stops describing anything. `makePin` refuses the value
// instead, the same way `ConfigSlot` refuses an unusable `promotedBase`.
describe('makePin refuses an on-value the cascade could never store', () => {
  const schema = ConfigurationSchema('TestDisplay', {
    mode: {
      type: 'maybeStringEnum',
      model: types.enumeration('Mode', ['normal', 'compact']),
      defaultValue: undefined,
      promotedBase: 'normal',
    },
    height: {
      type: 'maybeNumber',
      defaultValue: undefined,
      promotedBase: 5,
    },
  })

  // the sharpest case, because it fails in the *opposite* direction from the
  // others: `undefined` is the inherit sentinel, so with nothing promoted the
  // pin compares undefined to undefined and draws FILLED — a pin that looks
  // like the current default and clears nothing when clicked
  test('the inherit sentinel, passed explicitly', () => {
    const { display } = createDisplay(schema)
    // @ts-expect-error the sentinel is exactly what the value type excludes
    expect(() => makePin(display, 'mode', undefined)).toThrow(/cannot pin/)
  })

  test('a value outside a maybeStringEnum vocabulary', () => {
    const { display } = createDisplay(schema)
    // @ts-expect-error 'gone' is not one of the enumeration's members
    expect(() => makePin(display, 'mode', 'gone')).toThrow(/cannot pin/)
  })

  test('a non-finite number', () => {
    const { display } = createDisplay(schema)
    expect(() => makePin(display, 'height', Number.NaN)).toThrow(/cannot pin/)
  })

  // the value-omitted form settles on a cascade value, which is usable by
  // construction (a customized value passed the gate, and `promotedBase` passed
  // it at schema build), so it can never trip the guard
  test('the promote-current form is unaffected', () => {
    const { session, display } = createDisplay(schema)
    expect(makePin(display, 'mode').active).toBe(false)
    makePin(display, 'mode').toggle()
    soleAction(session.lastNotify).onClick()
    expect(makePin(display, 'mode').active).toBe(true)
    expect(resolveConf(display, 'mode')).toBe('normal')
  })
})

// A composite view (breakpoint-split, SV-inspector, the linear-comparative /
// synteny family) holds child views rather than tracks of its own, and a
// promotable display nested in one resolves the cascade like any other. Both
// callers of the open-display walk have to see it: "apply to open tracks" would
// undercount, and the share/export bake would not bake its inherited values —
// so a shared session rendered differently for the recipient.
// LGVSyntenyDisplay is only reachable this way.
describe('displays nested inside a composite view', () => {
  const configSchema = ConfigurationSchema('NestedDisplay', {
    customHeight: {
      type: 'maybeNumber',
      defaultValue: undefined,
      promotedBase: 1,
    },
  })

  // outer view shaped like LinearComparativeView: its OWN tracks plus child
  // views that each have tracks, so the walk must cover both branches
  function createNested() {
    const Display = testDisplayModel(configSchema)
    const Track = types.model('TestTrack', { displays: types.array(Display) })
    const Inner = types.model('TestInnerView', { tracks: types.array(Track) })
    const Outer = types.model('TestOuterView', {
      tracks: types.array(Track),
      views: types.array(Inner),
    })
    const Session = types
      .model('TestSession', {
        rpcManager: types.frozen({}),
        configuration: types.frozen({}),
        views: types.array(Outer),
      })
      .views(() => ({
        getDisplayTypeDefault(): unknown {
          return undefined
        },
      }))
      .actions(() => ({
        removeView() {},
        addView() {},
      }))
    const track = (customHeight: number) => ({
      displays: [
        { type: 'TestDisplay' as const, configuration: { customHeight } },
      ],
    })
    const session = Session.create(
      { views: [{ tracks: [track(10)], views: [{ tracks: [track(20)] }] }] },
      { pluginManager },
    )
    const outer = session.views[0]!
    return {
      ownDisplay: outer.tracks[0]!.displays[0]!,
      nestedDisplay: outer.views[0]!.tracks[0]!.displays[0]!,
    }
  }

  // both branches of the walk, in order: the outer view's own tracks and its
  // child views' tracks. A nested display is a track the pin's click writes, so
  // missing this branch silently leaves half a composite view behind.
  test('the open-display walk reaches the outer tracks and the child views', () => {
    const { ownDisplay, nestedDisplay } = createNested()
    expect(openTracksOfType(ownDisplay)).toEqual([ownDisplay, nestedDisplay])
  })
})

// The "flatten the cascade at every serialization boundary" rule. The
// top-level half of it is now enforced by the module graph — `fullConfSnapshot`
// is off the `@jbrowse/core/configuration` barrel, so a new `rpcProps()` can't
// spell the raw form at all and `getConfigSnapshotWithPromotables` is the only
// way across. What's left to test at runtime is the half no import can express.
describe('the serialization-boundary guard', () => {
  const schema = ConfigurationSchema('GuardedDisplay', {
    height: {
      type: 'maybeNumber',
      defaultValue: undefined,
      promotedBase: 7,
    },
  })

  test('getConfigSnapshotWithPromotables is the way through, and resolves', () => {
    const { session, display } = createDisplay(schema)
    session.setDisplayTypeDefault('TestDisplay', 'height', 3)
    expect(getConfigSnapshotWithPromotables(display)).toEqual({ height: 3 })
  })

  // A promotable slot buried in a sub-schema resolves nowhere: the cascade only
  // ever walks a display config's own top-level slot table. Left alone it would
  // serialize as the bare inherit sentinel and only misbehave once a worker read
  // it, so the snapshot refuses to build.
  test('a promotable slot in a nested schema throws rather than serializing', () => {
    const nested = ConfigurationSchema('NestedGuardedDisplay', {
      labels: ConfigurationSchema('GuardedLabels', {
        height: {
          type: 'maybeNumber',
          defaultValue: undefined,
          promotedBase: 7,
        },
      }),
    })
    const { display } = createDisplay(nested)
    expect(() => getConfigSnapshotWithPromotables(display)).toThrow(
      /nested config schema declares promotable slots \(height\)/,
    )
  })
})

// A promoted default arrives from an untyped, localStorage-backed store, so
// `isUsableValue` is the only thing standing between a corrupted entry and a
// consumer that trusts every value.
test('a promoted jexl string is rejected and falls back to the base', () => {
  const schema = ConfigurationSchema('PromotedJexlDisplay', {
    stroke: {
      type: 'maybeColor',
      defaultValue: undefined,
      promotedBase: 'black',
    },
  })
  const { session, display } = createDisplay(schema)
  // passes maybeColor's bare `typeof === 'string'` shape check
  session.setDisplayTypeDefault(
    'TestDisplay',
    'stroke',
    'jexl:get(feature,"c")',
  )
  expect(resolveConf(display, 'stroke')).toBe('black')
})

// The authoring mistakes a promotable slot can make have no runtime symptom
// beyond "this setting won't stay put", so `ConfigSlot` rejects them at schema
// construction rather than letting the resolver silently do the wrong thing.
//
// Declaring `promotedBase` is the only way to make a slot promotable, so the
// authoring mistakes left to guard are about the slot's *type* and default.
describe('promotable slot authoring guards', () => {
  test('rejects a non-maybe slot type', () => {
    // a plain enum has no spare value for "inherit", so `defaultValue` would
    // double as the inherit signal and 'fixed' could never be customized back
    // over an opposite promoted default
    expect(() =>
      ConfigurationSchema('PlainEnum', {
        mode: {
          type: 'stringEnum',
          model: types.enumeration('PlainEnumMode', ['fixed', 'fit']),
          defaultValue: 'fixed',
          promotedBase: 'fit',
        },
      }),
    ).toThrow(/needs a maybe\* type/)
  })

  // A subclass turns an inherited promotable slot back into a plain one by
  // stating `promotedBase: undefined`. This works because `mergeSchemaDefinition`
  // folds an override with a spread — a *stated* `undefined` overwrites the
  // base's value, where an omitted key would inherit it — so the merged
  // definition really has no base and the resolver refuses the slot.
  test('a subclass turns the slot off with promotedBase: undefined', () => {
    const base = ConfigurationSchema('TurnOffBase', {
      size: {
        type: 'maybeNumber',
        defaultValue: undefined,
        promotedBase: 7,
      },
    })
    const schema = ConfigurationSchema(
      'TurnOffSub',
      {
        size: {
          type: 'maybeNumber',
          defaultValue: undefined,
          promotedBase: undefined,
        },
      },
      { baseConfiguration: base },
    )
    const { display } = createDisplay(schema)
    expect(
      getSlotDefinition(display.configuration, 'size').promotedBase,
    ).toBeUndefined()
    expect(() => resolveConf(display, 'size')).toThrow(/not promotable/)
  })

  // the base is the bottom of the cascade — every other tier falls back to it —
  // so an unusable base is a value every read of the slot returns and nothing
  // else in the system checks
  test('rejects a promotedBase outside the slot enumeration', () => {
    expect(() =>
      ConfigurationSchema('BogusBase', {
        mode: {
          type: 'maybeStringEnum',
          model: types.enumeration('BogusBaseMode', ['normal', 'compact']),
          defaultValue: undefined,
          promotedBase: 'noSuchMode',
        },
      }),
    ).toThrow(/must be a value the slot can hold/)
  })

  test('rejects a non-finite numeric promotedBase', () => {
    expect(() =>
      ConfigurationSchema('NaNBase', {
        size: {
          type: 'maybeNumber',
          defaultValue: undefined,
          promotedBase: Number.NaN,
        },
      }),
    ).toThrow(/must be a value the slot can hold/)
  })

  test('rejects a promotedBase its own validate hook refuses', () => {
    expect(() =>
      ConfigurationSchema('UnvalidatedBase', {
        colorBy: {
          type: 'maybeFrozen',
          defaultValue: undefined,
          promotedBase: { type: 'retiredScheme' },
          validate: (value: unknown) =>
            typeof value === 'object' &&
            value !== null &&
            'type' in value &&
            value.type === 'normal',
        },
      }),
    ).toThrow(/must be a value the slot can hold/)
  })

  test('rejects a concrete defaultValue on a maybe slot', () => {
    expect(() =>
      ConfigurationSchema('ConcreteDefault', {
        size: {
          type: 'maybeNumber',
          defaultValue: 3,
          promotedBase: 7,
        },
      }),
    ).toThrow(/must leave 'defaultValue' undefined/)
  })

  // The cascade refuses a `jexl:` value at every tier (isUsableValue), so a
  // callback written into a promotable slot is discarded back to the base.
  // `contextVariable` is what raises the config editor's jexl toggle, so the
  // pair ships a control whose writes vanish — the one authoring mistake here
  // that shows up as UI rather than as a setting that won't stay put.
  test('rejects contextVariable, which would offer a callback the cascade drops', () => {
    expect(() =>
      ConfigurationSchema('PromotableCallback', {
        size: {
          type: 'maybeNumber',
          defaultValue: undefined,
          promotedBase: 7,
          contextVariable: ['feature'],
        },
      }),
    ).toThrow(/cannot declare 'contextVariable'/)
  })

  // a subclass overriding an inherited slot merges over the base's definition
  // rather than replacing it, so an override that moves one field keeps the rest
  // — including the promotable machinery, which is otherwise easy to drop and
  // whose only symptom would be resolveConf throwing on every read
  describe('a subclass override of an inherited promotable slot', () => {
    const base = ConfigurationSchema('PromotableBase', {
      colorBy: {
        type: 'maybeFrozen',
        defaultValue: undefined,
        promotedBase: { type: 'normal' },
        validate: (value: unknown) =>
          typeof value === 'object' && value !== null && 'type' in value,
        advanced: true,
        description: 'the base description',
      },
    })

    // LGVSyntenyDisplay over the alignments display, in miniature
    const schema = ConfigurationSchema(
      'MovesPromotedBase',
      {
        colorBy: {
          type: 'maybeFrozen',
          defaultValue: undefined,
          promotedBase: { type: 'strand' },
        },
      },
      { baseConfiguration: base },
    )
    const def = getSlotDefinition(schema.create(), 'colorBy')

    test('takes the override for what it states', () => {
      expect(def.promotedBase).toEqual({ type: 'strand' })
    })

    // an override states `promotedBase` and inherits the rest, `validate`
    // included — the case that motivated the field-by-field merge.
    test('inherits the validate hook it left out', () => {
      expect(def.validate).toBe(
        getSlotDefinition(base.create(), 'colorBy').validate,
      )
    })

    // the three fields real overrides were silently dropping
    test('inherits the base metadata it left out', () => {
      expect(def.advanced).toBe(true)
      expect(def.description).toBe('the base description')
    })

    test('resolves through the cascade using the overridden base', () => {
      const { display } = createDisplay(schema)
      expect(resolveConf(display, 'colorBy')).toEqual({ type: 'strand' })
    })
  })
})
