import type {
  ConfigurationSchemaType,
  ConfigurationSchemaOptions,
} from './configurationSchema'
import type ConfigSlot from './configurationSlot'
import type { IStateTreeNode, Instance, SnapshotOut } from 'mobx-state-tree'

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
    ?
        | (keyof D & string)
        | GetExplicitIdentifier<SCHEMA>
        | (GetBase<SCHEMA> extends ConfigurationSchemaType<any, any>
            ? ConfigurationSlotName<GetBase<SCHEMA>>
            : never)
    : never

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
