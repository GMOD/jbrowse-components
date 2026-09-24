import { getType, isType, unwrapType } from '@jbrowse/mobx-state-tree'

import type {
  ConfigurationSchemaDefinition,
  MergedConfigurationSchemaOptions,
} from './configurationSchema.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from './types.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

export interface ConfigurationSchemaMetadata {
  /** the name `ConfigurationSchema` was given, e.g. `FeatureColor` */
  name: string
  /** the raw slot/sub-schema/constant table, also carrying per-slot editor metadata */
  definition: ConfigurationSchemaDefinition
  /**
   * construction options (identifier kind, baseConfiguration, etc.) as stored,
   * i.e. with any `baseConfiguration`'s hooks already composed in
   */
  options: MergedConfigurationSchemaOptions<any, any>
  /** the frozen-family slots, the only members a snapshot's `null` is stored in */
  storesNull: ReadonlySet<string>
  /** the `featureField` slots, which the reader hands over as written */
  featureFields: ReadonlySet<string>
  /** the slots that refuse a `jexl:` string: every one but a callback and a featureField */
  takesNoCallback: ReadonlyMap<string, string>
}

// Per-schema metadata keyed by the model type `ConfigurationSchema` builds. A
// lookup arrives by any handle on it — the stripDefault wrapper the factory
// returns and a sub-schema property holds, an `optional` or `snapshotProcessor`
// around that, a resolved `types.late`, or `getType(node)` — and `unwrapType`
// takes each to the model. The type stays a plain MST type, "is this a config
// schema" is registry membership, and the map is weak, so a discarded schema
// type is collected normally.
const schemaRegistry = new WeakMap<IAnyType, ConfigurationSchemaMetadata>()

export function registerConfigurationSchema(
  type: IAnyType,
  metadata: ConfigurationSchemaMetadata,
) {
  schemaRegistry.set(type, metadata)
}

export function getConfigurationSchemaMetadata(type: IAnyType) {
  return schemaRegistry.get(unwrapType(type))
}

export function isRegisteredConfigurationSchema(type: IAnyType) {
  return schemaRegistry.has(unwrapType(type))
}

export interface ConfigurationSchemaUnionMetadata {
  /** the name `ConfigurationSchemaUnion` was given, e.g. `MarkTransform` */
  name: string
  /** each member schema, keyed by the `type` it answers to */
  members: Record<string, AnyConfigurationSchemaType>
}

const unionRegistry = new WeakMap<IAnyType, ConfigurationSchemaUnionMetadata>()

export function registerConfigurationSchemaUnion(
  type: IAnyType,
  metadata: ConfigurationSchemaUnionMetadata,
) {
  unionRegistry.set(type, metadata)
}

/**
 * The name and members of a union `ConfigurationSchemaUnion` built, or
 * undefined for any other type — a pluggable element union included.
 */
export function getConfigurationSchemaUnion(type: IAnyType) {
  return unionRegistry.get(type)
}

// The three lookups above take a schema *type*; the two below take a live config
// *node* and make the `getType` hop themselves, which is what every reader
// actually wants — a node is what they hold. Leaving the hop to the call site is
// how `slotFacade` came to reach the registry directly for `options` while going
// through a helper for `definition`.

/**
 * The slot/sub-schema/constant table for a config (includes slots merged in from
 * `baseConfiguration` at schema construction). Undefined when the argument isn't
 * a registered configuration schema. The single accessor for "what are this
 * config's slots?" — shared by the slot facade and `fullConfSnapshot`.
 *
 * Takes a live node *or* the schema type itself. Every in-tree reader holds a
 * node, which is why the `getType` hop is here; a caller enumerating registered
 * element types (`ConfigSlotDefaults.test.ts`) holds only the type, and for a
 * track schema it cannot get a node — `explicitIdentifier` makes `trackId` a
 * required MST identifier, so there is nothing to `create({})`.
 */
export function getConfigurationSchemaDefinition(
  nodeOrType: AnyConfigurationModel | IAnyType,
) {
  return getConfigurationSchemaMetadata(
    isType(nodeOrType) ? nodeOrType : getType(nodeOrType),
  )?.definition
}

/**
 * The construction options a live config node's schema was built with
 * (identifier kind, `explicitlyTyped`, the `preProcessSnapshot` hook). Undefined
 * when the node's type isn't a registered configuration schema.
 */
export function getConfigurationSchemaOptions(node: AnyConfigurationModel) {
  return getConfigurationSchemaMetadata(getType(node))?.options
}
