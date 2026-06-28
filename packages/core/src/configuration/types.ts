import type {
  ConfigurationSchemaOptions,
  ConfigurationSchemaType,
} from './configurationSchema.ts'
import type ConfigSlot from './configurationSlot.ts'
import type {
  ISimpleType,
  IStateTreeNode,
  Instance,
  SnapshotOut,
} from '@jbrowse/mobx-state-tree'

export type GetOptions<SCHEMA> =
  SCHEMA extends ConfigurationSchemaType<any, infer OPTIONS> ? OPTIONS : never

export type GetBase<SCHEMA> = SCHEMA extends undefined
  ? never
  : GetOptions<SCHEMA> extends ConfigurationSchemaOptions<undefined, any>
    ? undefined
    : GetOptions<SCHEMA> extends ConfigurationSchemaOptions<
          infer BASE extends AnyConfigurationSchemaType,
          any
        >
      ? BASE
      : never

export type GetExplicitIdentifier<SCHEMA> =
  GetOptions<SCHEMA> extends ConfigurationSchemaOptions<
    any,
    infer EXPLICIT_IDENTIFIER extends string
  >
    ? EXPLICIT_IDENTIFIER
    : never

export type ConfigurationSchemaForModel<MODEL> =
  MODEL extends IStateTreeNode<infer SCHEMA extends AnyConfigurationSchemaType>
    ? SCHEMA
    : never

export type ConfigurationSlotName<SCHEMA> = SCHEMA extends undefined
  ? never
  : SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? // this provides the ability to type check names in the config readConfObject usage
      // it is not commonly used but retained for now with this lint ignore

      | (keyof D & string)
      | GetExplicitIdentifier<SCHEMA>
      | (GetBase<SCHEMA> extends ConfigurationSchemaType<any, any>
          ? ConfigurationSlotName<GetBase<SCHEMA>>
          : never)
    : never

// Value type of a single slot. A `stringEnum` slot carries its precise literal
// union on `model` (a `types.enumeration`), so prefer that — it recovers the
// exact union (e.g. 'normal' | 'compact') instead of widening to `string`.
// Otherwise fall back to `defaultValue` (the slot's `type` string widens to
// `string` under generic inference and is unusable; the `defaultValue` literal
// survives as its widened type, which IS the value type). Only scalar slots
// (string/number/boolean) and enumerations are typed precisely — arrays, maps,
// sub-schemas, frozen, and constants degrade to `any` so existing call sites
// that relied on the old `any` return keep compiling. jexl callbacks are
// declared to return the slot's own type, so this is correct for them too.
type SlotValueFromDef<DEF> = DEF extends {
  model: ISimpleType<infer T extends string>
}
  ? T
  : DEF extends { defaultValue: infer V }
    ? [V] extends [boolean]
      ? V
      : [V] extends [string]
        ? V
        : [V] extends [number]
          ? V
          : any
    : any

export type ConfigurationSlotValue<SCHEMA, K extends string> =
  SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? K extends keyof D
      ? SlotValueFromDef<D[K]>
      : GetBase<SCHEMA> extends ConfigurationSchemaType<any, any>
        ? ConfigurationSlotValue<GetBase<SCHEMA>, K>
        : any
    : any

/**
 * Naming convention for config types, paired per schema:
 * - `XConfigSchema` is the MST IType (the schema itself). Use it for
 *   `getConf`, `ConfigurationReference`, and factory params — anywhere a schema
 *   is expected.
 * - `XConfigModel` is `Instance<XConfigSchema>` (a resolved config node). Use it
 *   for `readConfObject` results, model fields, and values read off a session.
 *
 * Prefer a named `XConfigModel` alias over inlining `Instance<XConfigSchema>` at
 * call sites. Two historical names predate this convention and stay as-is:
 * `BaseTrackConfig` (the track instance type) and `AnyConfiguration` (a
 * model-or-snapshot union, not a plain instance).
 */
export type AnyConfigurationSchemaType = ConfigurationSchemaType<any, any>
export type AnyConfigurationModel = Instance<AnyConfigurationSchemaType>
export type AnyConfigurationSlotType = ReturnType<typeof ConfigSlot>
export type AnyConfigurationSlot = Instance<AnyConfigurationSlotType>

/** any configuration model, or snapshot thereof */
export type AnyConfiguration =
  AnyConfigurationModel | SnapshotOut<AnyConfigurationModel>
