/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Instance } from 'mobx-state-tree'
import type {
  ConfigurationSchemaType,
  ConfigurationSchemaOptions,
} from './configurationSchema'
import type ConfigSlot from './configurationSlot'

export type GetOptions<SCHEMA> = SCHEMA extends ConfigurationSchemaType<
  any,
  infer OPTIONS
>
  ? OPTIONS
  : never

// type GetDefinition<SCHEMA> = SCHEMA extends ConfigurationSchemaType<
//   infer D,
//   any
// >
//   ? D
//   : never

export type GetBase<SCHEMA> =
  GetOptions<SCHEMA> extends ConfigurationSchemaOptions<undefined, any>
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

export type ConfigurationSchemaForModel<MODEL> = MODEL extends Instance<
  infer SCHEMA extends AnyConfigurationSchemaType
>
  ? SCHEMA
  : never

export type ConfigurationSlotName<SCHEMA> =
  SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? (keyof D & string) | GetExplicitIdentifier<SCHEMA>
    : // | ConfigurationSlotName<GetBase<SCHEMA>>
      never

export type AnyConfigurationSchemaType = ConfigurationSchemaType<any, any>
export type AnyConfigurationModel = Instance<AnyConfigurationSchemaType>
export type AnyConfigurationSlotType = ReturnType<typeof ConfigSlot>
export type AnyConfigurationSlot = Instance<AnyConfigurationSlotType>

export type ConfigurationModel<SCHEMA extends AnyConfigurationSchemaType> =
  Instance<SCHEMA>
