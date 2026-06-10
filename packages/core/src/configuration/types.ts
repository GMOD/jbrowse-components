import type {
  ConfigurationSchemaOptions,
  ConfigurationSchemaType,
} from './configurationSchema.ts'
import type ConfigSlot from './configurationSlot.ts'
import type {
  IStateTreeNode,
  Instance,
  SnapshotOut,
} from '@jbrowse/mobx-state-tree'

export type GetOptions<SCHEMA> =
  SCHEMA extends ConfigurationSchemaType<any, infer OPTIONS> ? OPTIONS : never

// type GetDefinition<SCHEMA> = SCHEMA extends ConfigurationSchemaType<
//   infer D,
//   any
// >
//   ? D
//   : never

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

// Value type of a single slot, derived from its `defaultValue` (the slot's
// `type` string widens to `string` under generic inference and is unusable; the
// `defaultValue` literal survives as its widened type, which IS the value type).
// Only scalar slots (string/number/boolean) are typed precisely — arrays, maps,
// sub-schemas, frozen, and constants degrade to `any` so existing call sites
// that relied on the old `any` return keep compiling. jexl callbacks are
// declared to return the slot's own type, so this is correct for them too.
type SlotValueFromDef<DEF> = DEF extends { defaultValue: infer V }
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

export type AnyConfigurationSchemaType = ConfigurationSchemaType<any, any>
export type AnyConfigurationModel = Instance<AnyConfigurationSchemaType>
export type AnyConfigurationSlotType = ReturnType<typeof ConfigSlot>
export type AnyConfigurationSlot = Instance<AnyConfigurationSlotType>

/** any configuration model, or snapshot thereof */
export type AnyConfiguration =
  | AnyConfigurationModel
  | SnapshotOut<AnyConfigurationModel>

export type ConfigurationModel<SCHEMA extends AnyConfigurationSchemaType> =
  Instance<SCHEMA>
