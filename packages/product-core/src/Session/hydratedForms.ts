import {
  canonicalSpelling,
  getConfigurationSchemaMetadata,
  isBareConfigurationSchemaType,
  writesWholeAt,
} from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { AssemblySnapshot, TrackSnapshot } from '../sessionUtils.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { DisplayForms } from '@jbrowse/core/util'
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
  /** What a track-config delta reads off the display schemas. */
  displays: DisplayForms
}

/**
 * A track-config delta's `DisplayForms`, off each display type's schema. A
 * type no loaded plugin registers writes nothing whole and keeps its spelling.
 */
export function displayForms(pluginManager: PluginManager): DisplayForms {
  const schemaOf = (displayType: string): unknown =>
    pluginManager.displayTypes.has(displayType)
      ? pluginManager.getDisplayType(displayType).configSchema
      : undefined
  return {
    wholeAt: (displayType, path) => writesWholeAt(schemaOf(displayType), path),
    canonical: (displayType, display) => {
      const schema = schemaOf(displayType)
      const meta = isBareConfigurationSchemaType(schema)
        ? getConfigurationSchemaMetadata(schema)
        : undefined
      return meta ? canonicalSpelling(meta, display) : display
    },
  }
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
    displays: displayForms(pluginManager),
    assembly: snapshotThrough<AssemblySnapshot>(
      assemblyConfigSchema,
      pluginManager,
    ),
  }
}
