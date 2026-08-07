import { getType } from '@jbrowse/mobx-state-tree'

import type {
  ConfigurationSchemaDefinition,
  ConfigurationSchemaOptions,
} from './configurationSchema.ts'
import type { AnyConfigurationModel } from './types.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

export interface ConfigurationSchemaMetadata {
  /** the raw slot/sub-schema/constant table, also carrying per-slot editor metadata */
  definition: ConfigurationSchemaDefinition
  /** construction options (identifier kind, baseConfiguration, etc.) */
  options: ConfigurationSchemaOptions<any, any>
}

// Per-schema metadata keyed by the MST type itself. Registered for BOTH the
// outer stripDefault wrapper (what `ConfigurationSchema` returns and what
// sub-schema properties hold) and the inner model (what `getType(node)` returns
// for a live config), so a lookup succeeds from either handle.
//
// This replaces stamping `jbrowseSchemaDefinition`/`jbrowseSchemaOptions`/
// `isJBrowseConfigurationSchema` onto the MST type objects: the type stays a
// plain MST type, "is this a config schema" is registry membership instead of a
// flag-or-name-match, and the metadata is reached by type identity. The map is
// weak, so a discarded schema type is collected normally.
const schemaRegistry = new WeakMap<IAnyType, ConfigurationSchemaMetadata>()

export function registerConfigurationSchema(
  type: IAnyType,
  metadata: ConfigurationSchemaMetadata,
) {
  schemaRegistry.set(type, metadata)
}

export function getConfigurationSchemaMetadata(type: IAnyType) {
  return schemaRegistry.get(type)
}

export function isRegisteredConfigurationSchema(type: IAnyType) {
  return schemaRegistry.has(type)
}

// The three lookups above take a schema *type*; the two below take a live config
// *node* and make the `getType` hop themselves, which is what every reader
// actually wants — a node is what they hold. Leaving the hop to the call site is
// how `slotFacade` came to reach the registry directly for `options` while going
// through a helper for `definition`.

/**
 * The slot/sub-schema/constant table for a live config node (includes slots
 * merged in from `baseConfiguration` at schema construction). Undefined when the
 * node's type isn't a registered configuration schema. The single accessor for
 * "what are this config's slots?" — shared by the slot facade, promotable
 * defaults, and `fullConfSnapshot`.
 */
export function getConfigurationSchemaDefinition(node: AnyConfigurationModel) {
  return getConfigurationSchemaMetadata(getType(node))?.definition
}

/**
 * The construction options a live config node's schema was built with
 * (identifier kind, `explicitlyTyped`, the `preProcessSnapshot` hook). Undefined
 * when the node's type isn't a registered configuration schema.
 */
export function getConfigurationSchemaOptions(node: AnyConfigurationModel) {
  return getConfigurationSchemaMetadata(getType(node))?.options
}
