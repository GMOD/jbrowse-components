import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema, getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { wiggleConfigSchemaFields } from './wiggleConfigSchemaFields.ts'

// The real wiggle size slots, driven through a minimal session so the
// promoted-default cascade runs for real (the shim mirrors
// promotableDefaults.test.ts). Both are sentinel slots, so their base value —
// lineWidth 1, the slider's leftmost stop — has to survive as a per-track
// customization over an opposite session-wide default; a plain number slot
// would spend that base as its inherit signal and silently re-inherit.
const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const configSchema = ConfigurationSchema('SizeSlots', wiggleConfigSchemaFields)

function createDisplay() {
  const Session = types
    .model('TestSession', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      displayTypeDefaults: types.frozen<Record<string, unknown>>({}),
      display: types
        .model('TestDisplay', {
          type: types.literal('TestDisplay'),
          configuration: configSchema,
          ignorePromotedDefaults: types.optional(types.boolean, false),
        })
        .actions(self => ({
          setIgnorePromotedDefaults(flag: boolean) {
            self.ignorePromotedDefaults = flag
          },
        })),
    })
    .views(self => ({
      getDisplayTypeDefault(_displayType: string, slot: string): unknown {
        return self.displayTypeDefaults[slot]
      },
    }))
    .actions(self => ({
      setDisplayTypeDefault(
        _displayType: string,
        slot: string,
        value: unknown,
      ) {
        self.displayTypeDefaults = {
          ...self.displayTypeDefaults,
          [slot]: value,
        }
      },
    }))
  const session = Session.create(
    { display: { type: 'TestDisplay', configuration: {} } },
    { pluginManager },
  )
  return { session, display: session.display }
}

describe.each([
  { slot: 'lineWidth', base: 1, promoted: 5 },
  { slot: 'scatterPointSize', base: 2, promoted: 6 },
] as const)('$slot', ({ slot, base, promoted }) => {
  test('resolves to its base with nothing promoted', () => {
    const { display } = createDisplay()
    expect(getConf(display, slot)).toBe(base)
  })

  test('follows a session-wide default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault('TestDisplay', slot, promoted)
    expect(getConf(display, slot)).toBe(promoted)
  })

  test('can be pinned back to its base over a session-wide default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault('TestDisplay', slot, promoted)
    display.configuration.setSlot(slot, base)
    expect(getConf(display, slot)).toBe(base)
  })
})
