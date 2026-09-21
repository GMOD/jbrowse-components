import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { AssemblySnapshot, TrackSnapshot } from '../sessionUtils.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

/**
 * A config as its own schema writes it back: shorthand expanded, a stub per
 * compatible display injected, every slot at its default left out. A
 * track-config delta is only exact between two configs in this form, because a
 * member one has and the other lacks then means a reset rather than two
 * spellings of one config.
 */
export interface HydratedForms {
  track: (conf: TrackSnapshot) => TrackSnapshot
  assembly: (conf: AssemblySnapshot) => AssemblySnapshot
}

function snapshotThrough<T>(schema: IAnyType, pluginManager: PluginManager) {
  return (conf: T) => getSnapshot(schema.create(conf, { pluginManager })) as T
}

export function hydratedTrackForm(pluginManager: PluginManager) {
  return snapshotThrough<TrackSnapshot>(
    pluginManager.pluggableConfigSchemaType('track'),
    pluginManager,
  )
}

export function hydratedForms(
  pluginManager: PluginManager,
  assemblyConfigSchema: IAnyType,
): HydratedForms {
  return {
    track: hydratedTrackForm(pluginManager),
    assembly: snapshotThrough<AssemblySnapshot>(
      assemblyConfigSchema,
      pluginManager,
    ),
  }
}
