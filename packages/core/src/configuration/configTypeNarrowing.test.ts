import { types } from '@jbrowse/mobx-state-tree'

import {
  ConfigurationReference,
  ConfigurationSchema,
} from './configurationSchema.ts'
import { getConf } from './index.ts'
import PluginManager from '../PluginManager.ts'

import type { IConfigurationReference } from './configurationSchema.ts'
import type { AnyConfigurationSchemaType } from './types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Regression guard for the config-read narrowing described in
// agent-docs/guides/CONFIG_TYPE_NARROWING.md. `Equal` is an exact type equality
// that ALSO distinguishes `any` from every concrete type, and `assertType`
// fails `pnpm typecheck` when its check is `false` — so a `getConf(self, slot)`
// read silently widening to `any` is caught here. A plain typecheck can't catch
// that regression on its own (`any` is assignable to everything), which is
// exactly the trap the guide warns about. These are compile-time only; the
// calls are runtime no-ops.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
function assertType<Check extends true>(_check?: Check): void {}

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const schema = ConfigurationSchema('ConfigNarrowingTest', {
  color: { type: 'color', defaultValue: 'red' },
  height: { type: 'number', defaultValue: 10 },
  enabled: { type: 'boolean', defaultValue: true },
  mode: {
    type: 'stringEnum',
    model: types.enumeration('Mode', ['a', 'b']),
    defaultValue: 'a',
  },
  // numeric slot whose default is a jexl string: must still type as `number`
  // (SlotValueFromDef keys scalars on `type`, not the string default value).
  thickness: { type: 'number', defaultValue: 'jexl:1+1' },
})

const Container = types.model('ConfigNarrowingContainer', {
  configuration: ConfigurationReference(schema),
})

describe('getConf slot-value type narrowing', () => {
  test('a concrete schema narrows reads to precise value types', () => {
    const model = Container.create(
      { configuration: { color: 'blue' } },
      { pluginManager },
    )

    const color = getConf(model, 'color')
    const height = getConf(model, 'height')
    const enabled = getConf(model, 'enabled')
    const mode = getConf(model, 'mode')
    const thickness = getConf(model, 'thickness')

    expect(color).toBe('blue')
    expect(height).toBe(10)
    expect(enabled).toBe(true)
    expect(mode).toBe('a')
    expect(thickness).toBe(2) // jexl:1+1 evaluated on read

    assertType<Equal<typeof color, string>>()
    assertType<Equal<typeof height, number>>()
    assertType<Equal<typeof enabled, boolean>>()
    assertType<Equal<typeof mode, 'a' | 'b'>>()
    assertType<Equal<typeof thickness, number>>()
  })

  // A factory that leaves its schema param widened to `AnyConfigurationSchemaType`
  // reads `any`, exactly as before this typing existed — so such factories keep
  // passing the structural checks (e.g. DisplayModel's `{ displayId: string }`)
  // that the old `any` instance satisfied vacuously. Guards the widened-schema
  // special-case in `IConfigurationReference`.
  test('a widened schema reference stays `any`', () => {
    assertType<
      Equal<Instance<IConfigurationReference<AnyConfigurationSchemaType>>, any>
    >()
    expect(true).toBe(true)
  })
})
