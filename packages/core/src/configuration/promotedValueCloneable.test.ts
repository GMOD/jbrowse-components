/**
 * @jest-environment node
 */
// Node, not jsdom, on purpose: this file asserts what V8's structured-clone
// serializer does, which is the algorithm behind `worker.postMessage` and
// electron IPC. jsdom provides no `structuredClone` at all, so under the default
// test environment `config/jest/structuredClone.js` shims it as a JSON
// round-trip — and that shim happily clones a Proxy, which is precisely the case
// under test. Node has the real one.
import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { resolveConf } from './getConf.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

// mirrors alignments' `colorBy`: a promotable object-valued slot
const configSchema = ConfigurationSchema('CloneDisplay', {
  colorBy: {
    type: 'maybeFrozen',
    defaultValue: undefined,
    promotedBase: { type: 'normal' },
    promotable: true,
  },
})

// `deep` picks the enhancer BaseSession's `preferencesOverrides` map uses. The
// default (`deep: true`) is what shipped before and is kept here as the
// counter-example: it is the whole reason the production map declares
// `deep: false`.
function createDisplay(deep: boolean) {
  const Display = types.model('CloneDisplay', {
    type: types.literal('CloneDisplay'),
    configuration: configSchema,
    ignorePromotedDefaults: types.optional(types.boolean, false),
  })
  const Session = types
    .model('CloneSession', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      display: Display,
    })
    .volatile(() => ({
      preferencesOverrides: observable.map<string, unknown>(undefined, {
        deep,
      }),
    }))
    .views(self => ({
      getDisplayTypeDefault(displayType: string, slot: string) {
        return self.preferencesOverrides.get(`${displayType}\0${slot}`)
      },
    }))
    .actions(self => ({
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        self.preferencesOverrides.set(`${displayType}\0${slot}`, value)
      },
    }))
  const session = Session.create(
    { display: { type: 'CloneDisplay', configuration: {} } },
    { pluginManager },
  )
  return session
}

// The production shape: a promoted object default survives the trip to a worker.
test('a promoted object default resolves to a structured-cloneable value', () => {
  const session = createDisplay(false)
  session.setDisplayTypeDefault('CloneDisplay', 'colorBy', {
    type: 'insertSizeAndOrientation',
  })
  // what `rpcProps()` puts on the wire for a track following the default
  const onTheWire = resolveConf(session.display, 'colorBy')
  expect(() => structuredClone(onTheWire)).not.toThrow()
  expect(onTheWire).toEqual({ type: 'insertSizeAndOrientation' })
})

// Why the `deep: false` above is load-bearing rather than a micro-optimization:
// a deep observable map wraps the value in a Proxy on `set`, `resolveSlot` hands
// that Proxy straight back out as the resolved value, and postMessage rejects it.
test('a deep observable store would hand out a value postMessage rejects', () => {
  const session = createDisplay(true)
  session.setDisplayTypeDefault('CloneDisplay', 'colorBy', {
    type: 'insertSizeAndOrientation',
  })
  expect(() =>
    structuredClone(resolveConf(session.display, 'colorBy')),
  ).toThrow(/could not be cloned/)
})
