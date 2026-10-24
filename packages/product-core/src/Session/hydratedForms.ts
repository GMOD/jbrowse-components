import {
  getConfigurationSchemaMetadata,
  isBareConfigurationSchemaType,
  liftRetiredSpellings,
  writesWholeAt,
} from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { AssemblySnapshot, TrackSnapshot } from '../sessionUtils.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { WholeAt } from '@jbrowse/core/util'
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
  /** Which display objects a delta stores whole. */
  wholeAt: WholeAt
}

/**
 * A track-config delta's `wholeAt`, off each display type's schema; false for
 * a type no loaded plugin registers.
 */
export function displayWholeAt(pluginManager: PluginManager): WholeAt {
  return (displayType, path) =>
    pluginManager.displayTypes.has(displayType) &&
    writesWholeAt(pluginManager.getDisplayType(displayType).configSchema, path)
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

function liftedAtEveryDepth(
  schema: unknown,
  bag: Record<string, unknown>,
): Record<string, unknown> {
  const meta = isBareConfigurationSchemaType(schema)
    ? getConfigurationSchemaMetadata(schema)
    : undefined
  if (!meta) {
    return bag
  }
  const lifted = liftRetiredSpellings(meta, bag)
  let out = lifted
  for (const [key, value] of Object.entries(lifted)) {
    if (isRecord(value) && Object.hasOwn(meta.definition, key)) {
      const next = liftedAtEveryDepth(meta.definition[key], value)
      if (next !== value) {
        out = out === lifted ? { ...lifted } : out
        out[key] = next
      }
    }
  }
  return out
}

/**
 * A stored delta with its displays' retired spellings lifted, each by the
 * schema of the display it lands on in the hydrated `base`, since a delta
 * display names its type only when the edit changed it. Merged as stored, an
 * old spelling loses to a base writing the same member in the current one,
 * and its `null` resets nothing. The delta itself when it holds none.
 */
export function deltaInCurrentSpelling(pluginManager: PluginManager) {
  return <T extends Record<string, unknown>>(
    base: Record<string, unknown>,
    delta: T,
  ): T => {
    const { displays } = delta
    if (!Array.isArray(displays)) {
      return delta
    }
    const baseDisplays = Array.isArray(base.displays)
      ? (base.displays as unknown[]).filter(isRecord)
      : []
    const next = displays.map((d: unknown) => {
      if (!isRecord(d)) {
        return d
      }
      const baseDisplay =
        baseDisplays.find(b => b.displayId === d.displayId) ??
        baseDisplays.find(b => d.type !== undefined && b.type === d.type)
      const type = d.type ?? baseDisplay?.type
      return typeof type === 'string' && pluginManager.displayTypes.has(type)
        ? liftedAtEveryDepth(pluginManager.getDisplayType(type).configSchema, d)
        : d
    })
    return next.some((d, i) => d !== displays[i])
      ? { ...delta, displays: next }
      : delta
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
    wholeAt: displayWholeAt(pluginManager),
    assembly: snapshotThrough<AssemblySnapshot>(
      assemblyConfigSchema,
      pluginManager,
    ),
  }
}
