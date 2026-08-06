import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from './configurationSchema.ts'
import { getConf, readConfObject, resolveConf, setConf } from './index.ts'

import type { IConfigurationReference } from './configurationSchema.ts'
import type {
  AnyConfigurationSchemaType,
  AnyConfigurationSnapshot,
} from './types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Regression guard for the config-read narrowing described in
// ./CLAUDE.md ("Config read type narrowing"). `Equal` is an exact type equality
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

// Promotable sentinel slots + one plain `maybe` slot, to guard that
// `SlotValueFromDef` drops the inherit sentinel from a `getConf` read *only* for
// `promotedBase` slots (see ./CLAUDE.md and DISPLAY_TYPE_DEFAULTS.md).
const promotableSchema = ConfigurationSchema('ConfigNarrowingPromotable', {
  mode: {
    type: 'maybeStringEnum',
    model: types.enumeration('PromMode', ['a', 'b']),
    defaultValue: undefined,
    promotedBase: 'a',
  },
  chevrons: {
    type: 'maybeBoolean',
    defaultValue: undefined,
    promotedBase: true,
  },
  size: {
    type: 'maybeNumber',
    defaultValue: undefined,
    promotedBase: 7,
  },
  // no `promotedBase`: an ordinary optional slot, whose read must still surface
  // `undefined` — the exclusion is keyed on `promotedBase`, not `maybe*`
  plainSize: { type: 'maybeNumber', defaultValue: undefined },
  // the object-valued sentinel (alignments `colorBy`). `maybeFrozen` is `any`
  // like plain `frozen`, so both readers agree — asserted so it stays a listed
  // case rather than drifting back into the `defaultValue` fallback
  colorBy: {
    type: 'maybeFrozen',
    defaultValue: undefined,
    promotedBase: { type: 'normal' },
  },
})

// A subclass turns an inherited promotable slot off by stating
// `promotedBase: undefined`, and the sentinel must survive in BOTH read types.
//
// This is the canary for the *first* branch of `SlotValueResolvedFromDef`, which
// looks redundant and is not: `{ promotedBase: undefined }` satisfies
// `{ promotedBase: unknown }`, so keying only on the latter would resolve the
// sentinel away for the one slot that just stopped being promotable — tsc would
// promise a `number` while `resolveConf` threw "not promotable" at runtime.
const turnedOffSchema = ConfigurationSchema(
  'ConfigNarrowingTurnedOff',
  {
    size: {
      type: 'maybeNumber',
      defaultValue: undefined,
      promotedBase: undefined,
    },
  },
  { baseConfiguration: promotableSchema },
)

// `resolveConf` asks for the display node the cascade reads (type + config), so
// these model that rather than a bare config holder. Type-only fixtures — never
// `.create()`d.
const PromotableContainer = types.model('ConfigNarrowingPromotableContainer', {
  type: types.string,
  configuration: ConfigurationReference(promotableSchema),
})

const TurnedOffContainer = types.model('ConfigNarrowingTurnedOffContainer', {
  type: types.string,
  configuration: ConfigurationReference(turnedOffSchema),
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

  // The two readers differ in exactly one way on a promotable slot, and that
  // difference IS the guard: `resolveConf` runs the cascade and can only yield a
  // real value, while `getConf` stays raw and surfaces the `undefined` inherit
  // sentinel — so handing a raw read to a consumer expecting a real mode is a
  // compile error pointing at the call that should have resolved. Type-only:
  // resolution consults a session at runtime, so this exercises the return TYPE
  // (computed from the schema alone) without invoking it.
  test('resolveConf drops the inherit sentinel, getConf keeps it', () => {
    const check = (model: Instance<typeof PromotableContainer>) => {
      // resolved: never the sentinel, so a display getter needs no cast
      const mode = resolveConf(model, 'mode')
      const chevrons = resolveConf(model, 'chevrons')
      const size = resolveConf(model, 'size')
      assertType<Equal<typeof mode, 'a' | 'b'>>()
      assertType<Equal<typeof chevrons, boolean>>()
      assertType<Equal<typeof size, number>>()

      // raw: the sentinel is still there to be handled
      const rawMode = getConf(model, 'mode')
      const rawChevrons = getConf(model, 'chevrons')
      const rawSize = getConf(model, 'size')
      assertType<Equal<typeof rawMode, 'a' | 'b' | undefined>>()
      assertType<Equal<typeof rawChevrons, boolean | undefined>>()
      assertType<Equal<typeof rawSize, number | undefined>>()

      // a plain `maybe` slot (no `promotedBase`) reads the same either way
      const plainSize = getConf(model, 'plainSize')
      assertType<Equal<typeof plainSize, number | undefined>>()

      // ...as does `maybeFrozen`, which is `any` like plain `frozen` — pinned
      // here so it stays a listed case rather than drifting back into the
      // `defaultValue` fallback that only lands on `any` by accident
      const colorBy = resolveConf(model, 'colorBy')
      const rawColorBy = getConf(model, 'colorBy')
      assertType<Equal<typeof colorBy, any>>()
      assertType<Equal<typeof rawColorBy, any>>()
    }
    void check
    expect(true).toBe(true)
  })

  // A subclass that turns an inherited promotable slot off states
  // `promotedBase: undefined`, so `resolveConf` throws there — and both read
  // types must keep the sentinel rather than promising a value that read can't
  // produce.
  test('a slot turned off with promotedBase: undefined keeps the sentinel', () => {
    const check = (model: Instance<typeof TurnedOffContainer>) => {
      const size = resolveConf(model, 'size')
      const rawSize = getConf(model, 'size')
      assertType<Equal<typeof size, number | undefined>>()
      assertType<Equal<typeof rawSize, number | undefined>>()
    }
    void check
    expect(true).toBe(true)
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

  // Slot-name typo guard, for BOTH directions. `setConf`'s constraint once
  // carried a stray `| string` (where `getConf`'s is `| string[]`, for slot
  // paths), which silently admitted any string. An unknown slot name is the one
  // config mistake with no diagnostic at runtime either: `setSlot` assigns to an
  // undeclared property, so nothing throws, nothing persists, and the matching
  // `getConf` read keeps returning the default. These `@ts-expect-error`s fail
  // `pnpm typecheck` if either constraint is ever re-loosened, since the expected
  // error would no longer occur. Type-only, never executed.
  test('an unknown slot name is a compile error through getConf and setConf', () => {
    const check = (model: Instance<typeof Container>) => {
      // @ts-expect-error -- 'notASlot' is not in the schema
      getConf(model, 'notASlot')
      // @ts-expect-error -- 'notASlot' is not in the schema
      setConf(model, 'notASlot', 1)
    }
    void check
    expect(true).toBe(true)
  })

  // A sub-config slot read yields the parent's stripDefault'd snapshot, so
  // reading a *defaulted* slot back off it answers undefined instead of the
  // default. The whole fix is that the snapshot no longer types as `any`, which
  // is what let it be fed back in: keep both halves, or the hazard returns
  // silently. See readConfObject's doc comment and CONFIG_PATTERN.md.
  test('a sub-config slot read is a snapshot, and not readable as a config', () => {
    const nested = ConfigurationSchema('ConfigNarrowingNested', {
      sub: ConfigurationSchema('ConfigNarrowingSub', {
        limit: { type: 'number', defaultValue: 5_000_000 },
      }),
      plain: { type: 'number', defaultValue: 1 },
    })
    const check = (config: Instance<typeof nested>) => {
      // the read is typed as transport data, NOT `any`
      const sub = readConfObject(config, 'sub')
      assertType<Equal<typeof sub, AnyConfigurationSnapshot>>()

      // ...so the wrong spelling of a nested read cannot compile
      // @ts-expect-error -- a snapshot is not a readable config
      readConfObject(sub, 'limit')

      // a whole-config read is that same snapshot, not a union of slot values
      const whole: AnyConfigurationSnapshot = readConfObject(config)
      void whole

      // an ordinary slot still narrows to its own value type
      const plain = readConfObject(config, 'plain')
      assertType<Equal<typeof plain, number>>()
    }
    void check
    expect(true).toBe(true)
  })
})
