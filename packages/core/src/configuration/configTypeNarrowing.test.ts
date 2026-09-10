import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from './configurationSchema.ts'
import { getConf, readConfObject, setConf } from './index.ts'

import type { FileLocation } from '../util/types/index.ts'
import type { IConfigurationReference } from './configurationSchema.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  AnyConfigurationSnapshot,
  ConfigurationSnapshot,
  HostChecksSlotNames,
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

// A `maybe*` slot reads as `T | undefined`, and `maybeFrozen` is `any` like
// plain `frozen` — pinned so it stays a listed case rather than drifting back
// into the `defaultValue` fallback that only lands on `any` by accident.
const maybeSchema = ConfigurationSchema('ConfigNarrowingMaybe', {
  plainSize: { type: 'maybeNumber' },
  colorBy: { type: 'maybeFrozen' },
})

// Type-only fixture — never `.create()`d.
const MaybeContainer = types.model('ConfigNarrowingMaybeContainer', {
  configuration: ConfigurationReference(maybeSchema),
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

    // A whole-config read is the snapshot, and needs its own overload to say
    // so: with `slotPath` omitted, SLOT falls back to the union of every slot
    // name and the return conditional distributes over it, typing the read as a
    // union of every slot's VALUE. The twin assertion for `readConfObject` is
    // in the sub-config test below.
    const whole: AnyConfigurationSnapshot = getConf(model)
    expect(whole.color).toBe('blue')
  })

  // One row of `SlotValueByType` per read. The mapping used to be a fourteen-deep
  // conditional staircase where a branch's *position* was load-bearing, and the
  // only coverage was the handful of types above; it is a table now, so pin the
  // whole table. A row that changes or goes missing lands the slot on the
  // `defaultValue` fallback, which for most of these means silently becoming
  // `any` — assignable everywhere, so nothing else in the repo would notice.
  test('every builtin slot type reads as its declared value type', () => {
    const all = ConfigurationSchema('ConfigNarrowingAllTypes', {
      stringArray: { type: 'stringArray', defaultValue: [] },
      stringArrayMap: { type: 'stringArrayMap', defaultValue: {} },
      numberMap: { type: 'numberMap', defaultValue: {} },
      fileLocation: {
        type: 'fileLocation',
        defaultValue: { uri: 'x.txt', locationType: 'UriLocation' },
      },
      maybeNumber: { type: 'maybeNumber', defaultValue: undefined },
      maybeBoolean: { type: 'maybeBoolean', defaultValue: undefined },
      maybeColor: { type: 'maybeColor', defaultValue: undefined },
      frozen: { type: 'frozen', defaultValue: {} },
      maybeFrozen: { type: 'maybeFrozen', defaultValue: undefined },
      number: { type: 'number', defaultValue: 1 },
      integer: { type: 'integer', defaultValue: 1 },
      boolean: { type: 'boolean', defaultValue: false },
      string: { type: 'string', defaultValue: '' },
      text: { type: 'text', defaultValue: '' },
      color: { type: 'color', defaultValue: 'red' },
    })
    const node = all.create(undefined, { pluginManager })

    const stringArray = readConfObject(node, 'stringArray')
    const stringArrayMap = readConfObject(node, 'stringArrayMap')
    const numberMap = readConfObject(node, 'numberMap')
    const fileLocation = readConfObject(node, 'fileLocation')
    const maybeNumber = readConfObject(node, 'maybeNumber')
    const maybeBoolean = readConfObject(node, 'maybeBoolean')
    const maybeColor = readConfObject(node, 'maybeColor')
    const frozen = readConfObject(node, 'frozen')
    const maybeFrozen = readConfObject(node, 'maybeFrozen')
    const number = readConfObject(node, 'number')
    const integer = readConfObject(node, 'integer')
    const boolean = readConfObject(node, 'boolean')
    const string = readConfObject(node, 'string')
    const text = readConfObject(node, 'text')
    const color = readConfObject(node, 'color')

    assertType<Equal<typeof stringArray, string[]>>()
    assertType<Equal<typeof stringArrayMap, Record<string, string[]>>>()
    assertType<Equal<typeof numberMap, Record<string, number>>>()
    assertType<Equal<typeof fileLocation, FileLocation>>()
    assertType<Equal<typeof maybeNumber, number | undefined>>()
    assertType<Equal<typeof maybeBoolean, boolean | undefined>>()
    assertType<Equal<typeof maybeColor, string | undefined>>()
    // the escape hatch for dynamic JSON, `any` on purpose in both forms
    assertType<Equal<typeof frozen, any>>()
    assertType<Equal<typeof maybeFrozen, any>>()
    assertType<Equal<typeof number, number>>()
    assertType<Equal<typeof integer, number>>()
    assertType<Equal<typeof boolean, boolean>>()
    assertType<Equal<typeof string, string>>()
    assertType<Equal<typeof text, string>>()
    assertType<Equal<typeof color, string>>()

    // the values round-trip too, so this isn't purely a type fixture
    expect(integer).toBe(1)
    expect(maybeNumber).toBeUndefined()
    expect(color).toBe('red')
  })

  test('a maybe* slot surfaces its unset state at the read', () => {
    const check = (model: Instance<typeof MaybeContainer>) => {
      const plainSize = getConf(model, 'plainSize')
      const colorBy = getConf(model, 'colorBy')
      assertType<Equal<typeof plainSize, number | undefined>>()
      assertType<Equal<typeof colorBy, any>>()
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

  // `ConfigurationSnapshot` is what an embedder's `configuration` option is
  // typed as. A key the schema does not declare is dropped on the way in with
  // nothing said, so rejecting the misspelling is the entire value of the type
  // — including inside a sub-schema, which is where the settings an embedder
  // reaches for actually live (`preferences.scrollZoom`).
  test('a config snapshot rejects a name the schema does not declare', () => {
    const base = ConfigurationSchema('ConfigSnapshotBase', {
      inherited: { type: 'number', defaultValue: 0 },
    })
    const schemaWithSub = ConfigurationSchema(
      'ConfigSnapshotOuter',
      {
        sub: ConfigurationSchema('ConfigSnapshotInner', {
          limit: { type: 'number', defaultValue: 5 },
        }),
        plain: { type: 'number', defaultValue: 1 },
      },
      { baseConfiguration: base, explicitIdentifier: 'outerId' },
    )
    type Snapshot = ConfigurationSnapshot<typeof schemaWithSub>

    // own slots, a sub-schema's slots, the identifier and the base's slots
    const ok: Snapshot = {
      plain: 2,
      sub: { limit: 10 },
      outerId: 'one',
      inherited: 3,
    }
    void ok

    const topLevelTypo: Snapshot = {
      // @ts-expect-error -- 'plane' is not a slot on the schema
      plane: 2,
    }
    void topLevelTypo

    const subSchemaTypo: Snapshot = {
      sub: {
        // @ts-expect-error -- 'limt' is not a slot on the sub-schema
        limt: 10,
      },
    }
    void subSchemaTypo
    expect(true).toBe(true)
  })
})

// A cross-cutting mixin can't see the `configuration` its composing display
// supplies, so it casts to reach it. **What it casts to decides whether the
// slot names below it are checked at all**, and the two spellings that look
// equivalent are not: a host type naming the concrete schema narrows, while
// intersecting with one that declares `configuration: AnyConfigurationModel`
// re-widens, because the intersection keeps the widened member.
// `HeightModeMixin` and `WiggleScoreConfigMixin` both shipped the intersection
// spelling and neither was checking anything; only a sabotage found it, since
// the widened form has no symptom at all. `HostChecksSlotNames` is the assertion
// each mixin pins itself with.
interface AnyConfigHost {
  configuration: AnyConfigurationModel
}

describe('a mixin host type narrows the slot names, or silently does not', () => {
  it('narrows through a host naming the concrete schema', () => {
    assertType<
      Equal<
        HostChecksSlotNames<{ configuration: Instance<typeof schema> }>,
        true
      >
    >()
    expect(true).toBe(true)
  })

  it('does NOT narrow through an intersection with a widened host', () => {
    // the failing half, asserted rather than described. If this ever flips to
    // `true`, the intersection spelling became safe.
    assertType<
      Equal<
        HostChecksSlotNames<
          AnyConfigHost & { configuration: Instance<typeof schema> }
        >,
        false
      >
    >()
    expect(true).toBe(true)
  })
})
