import { isArrayType, isOptionalType, types } from '@jbrowse/mobx-state-tree'

import { getSubType } from '../util/mst-reflection.ts'
import {
  getConfigurationSchemaMetadata,
  getConfigurationSchemaUnion,
  registerConfigurationSchemaUnion,
} from './schemaRegistry.ts'
import { listed } from './snapshotPreprocess.ts'

import type {
  ConfigurationSchemaOptions,
  ConfigurationSchemaType,
} from './configurationSchema.ts'
import type { AnyConfigurationSchemaType } from './types.ts'
import type {
  IAnyType,
  ISimpleType,
  IType,
  SnapshotIn,
  SnapshotOut,
} from '@jbrowse/mobx-state-tree'

interface NamedTypeSlotDef<NAME extends string> {
  type: 'stringEnum'
  model: ISimpleType<NAME>
}

type Named<SCHEMA, NAME extends string> =
  SCHEMA extends ConfigurationSchemaType<
    infer D,
    infer O extends ConfigurationSchemaOptions<any, any>
  >
    ? ConfigurationSchemaType<
        { [K in keyof D]: K extends 'type' ? NamedTypeSlotDef<NAME> : D[K] },
        O
      >
    : never

type UnionNode<MEMBERS> = {
  [K in keyof MEMBERS & string]: Named<MEMBERS[K], K>['Type']
}[keyof MEMBERS & string]

/**
 * A union of configuration schemas, each member's node reading its `type` as
 * the key it is listed under — so a `switch` over it narrows to that member's
 * own slots.
 */
export type ConfigurationSchemaUnionType<
  MEMBERS extends Record<string, AnyConfigurationSchemaType>,
> = Omit<
  IType<
    SnapshotIn<MEMBERS[keyof MEMBERS]>,
    SnapshotOut<MEMBERS[keyof MEMBERS]>,
    UnionNode<MEMBERS>
  >,
  'Type'
> & { readonly Type: UnionNode<MEMBERS> }

function memberRefusal(key: string, member: AnyConfigurationSchemaType) {
  const meta = getConfigurationSchemaMetadata(member)
  return !meta
    ? 'which is not a configuration schema'
    : meta.name !== key
      ? `whose schema names itself "${meta.name}"`
      : !meta.options.explicitlyTyped
        ? 'which is not explicitlyTyped, so its snapshot names no type to dispatch on'
        : !meta.options.closed
          ? 'which is not closed, so a key of another member would be dropped in silence'
          : undefined
}

/**
 * #api core/configuration
 * A list entry that is one of several configuration schemas, each keyed by the
 * `type` it answers to: `types.array(ConfigurationSchemaUnion('Step', { filter,
 * bin }))`. The keys are the vocabulary, the snapshot's `type` picks the
 * member, and a `type` naming no member is refused in every build — where a
 * bare `types.union` would load it as its first member. Each member is an
 * `explicitlyTyped`, `closed` schema named by its key, so a key belonging to
 * another member is refused rather than dropped; one that is not throws here.
 */
export function ConfigurationSchemaUnion<
  const MEMBERS extends Record<string, AnyConfigurationSchemaType>,
>(name: string, members: MEMBERS): ConfigurationSchemaUnionType<MEMBERS> {
  for (const [key, member] of Object.entries(members)) {
    const refusal = memberRefusal(key, member)
    if (refusal) {
      throw new Error(`${name} lists "${key}", ${refusal}`)
    }
  }
  const names = Object.keys(members)
  const union: ConfigurationSchemaUnionType<MEMBERS> = types.union(
    {
      dispatcher: (snapshot: { type?: unknown } | undefined) => {
        const type = snapshot?.type
        if (typeof type === 'string' && Object.hasOwn(members, type)) {
          return members[type]!
        }
        throw new Error(
          `a ${name} names its type, one of ${listed(names)}, ${
            type === undefined
              ? 'and names none'
              : `not ${JSON.stringify(type)}`
          }`,
        )
      },
    },
    ...Object.values(members),
  )
  registerConfigurationSchemaUnion(union, { name, members })
  return union
}

/**
 * #api core/configuration
 * The `ConfigurationSchemaUnion` an array slot's entries answer to, read off
 * the slot's MST type, or undefined for any other slot.
 */
export function arraySlotUnion(slotType: IAnyType) {
  const array = isOptionalType(slotType) ? getSubType(slotType) : slotType
  return isArrayType(array)
    ? getConfigurationSchemaUnion(array.getChildType())
    : undefined
}
