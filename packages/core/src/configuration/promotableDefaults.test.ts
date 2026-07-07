import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import {
  areSlotsAtSessionDefault,
  getConfResolved,
  isSlotPinned,
  setSlotsSessionDefault,
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

// A promotable `maybeNumber` slot has no real `defaultValue` to type-check a
// promoted value against (its default is the "unset" sentinel `undefined`) —
// `promotedUsable` special-cases this to validate against `number` instead.
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
})

// A slot's `validate` hook lets `promotedUsable` reject a value that's
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
