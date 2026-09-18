import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'

import type { IAnyType } from '@jbrowse/mobx-state-tree'

interface SnapshotOptions {
  shorthand?: string
  preProcessSnapshot?: (
    snapshot: Record<string, unknown>,
  ) => Record<string, unknown>
}

/**
 * What a schema does to every snapshot on its way in, whichever door it
 * arrives by (`create`, `applySnapshot`, `setSubschema`, a settings bag): a
 * bare string lifts into the declared `shorthand` slot, then the schema's own
 * `preProcessSnapshot` runs.
 */
export function preProcessSnapshotWith(
  { shorthand, preProcessSnapshot }: SnapshotOptions,
  snapshot: unknown,
): Record<string, unknown> {
  const lifted =
    shorthand !== undefined && typeof snapshot === 'string'
      ? { [shorthand]: snapshot }
      : (snapshot as Record<string, unknown>)
  return preProcessSnapshot ? preProcessSnapshot(lifted) : lifted
}

/**
 * #api core/configuration
 * A snapshot as `type` admits it: the same lift and checks `type.create`
 * applies, so a dialog or a validator refuses exactly what a config file
 * cannot hold. Throws what the schema's `preProcessSnapshot` throws.
 */
export function preProcessConfigSnapshot(type: IAnyType, snapshot: unknown) {
  return preProcessSnapshotWith(
    getConfigurationSchemaMetadata(type)?.options ?? {},
    snapshot,
  )
}
