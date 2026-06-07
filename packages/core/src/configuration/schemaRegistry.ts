import type {
  ConfigurationSchemaDefinition,
  ConfigurationSchemaOptions,
} from './configurationSchema.ts'
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
