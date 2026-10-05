import { getType, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { isPlainObject } from '../util/objectUtils.ts'
import { readConfObject } from './readConfObject.ts'
import {
  getConfigurationSchemaDefinition,
  getConfigurationSchemaMetadata,
} from './schemaRegistry.ts'
import {
  isConfigurationModel,
  isConfigurationSchemaType,
  isConstantEntry,
} from './schemaTypes.ts'
import { preProcessSnapshotWith } from './snapshotPreprocess.ts'

import type {
  AnyConfigurationModel,
  AnyConfigurationSnapshot,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotPath,
  ConfigurationSlotPathValue,
  ConfigurationSlotValue,
} from './types.ts'

// The whole-config overload comes first, or omitting `slotPath` distributes the
// return over every slot name and types it as a union of slot values.
/**
 * #api core/configuration
 * Reads a configuration value from a track or display state model: exactly
 * `readConfObject(model.configuration, path)`, with the same slot-name check.
 *
 * @param model - object containing a 'configuration' member
 * @param slotPaths - array of paths to read
 * @param args - extra arguments e.g. for a feature callback,
 *   will be sent to each of the slotNames
 */
export function getConf(model: {
  configuration: AnyConfigurationModel
}): AnyConfigurationSnapshot
export function getConf<
  CONFMODEL extends AnyConfigurationModel,
  const SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | ConfigurationSlotPath<ConfigurationSchemaForModel<CONFMODEL>> =
    ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  model: { configuration: CONFMODEL },
  slotPath: SLOT,
  args?: Record<string, unknown>,
): SLOT extends string
  ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
  : ConfigurationSlotPathValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
export function getConf(
  model: { configuration: AnyConfigurationModel },
  slotPath?: string | string[],
  args: Record<string, unknown> = {},
): any {
  return readConfObject(model.configuration, slotPath, args)
}

/**
 * #api core/configuration
 * Write counterpart to `getConf`, and it takes the same path: a slot name, or
 * an array naming a sub-schema's member at any depth —
 * `setConf(self, ['scales', 'y', 'domainMin'], 5)`. Takes the display or track
 * model, or a config node directly.
 *
 * A path ending on a slot writes that slot; one ending on a sub-schema replaces
 * the whole object, so a channel's members (a facet's field and its domain)
 * move together. On a concrete schema an unknown slot name is a compile error,
 * and `setSlot` refuses one at runtime (ADR-052). A wrong value type throws at
 * runtime; `null` or `undefined` resets the slot to its default (ADR-146).
 *
 * @param target - a model with a `configuration` member, or a config node
 * @param slotPath - the slot to write, or the path to one
 * @param value - the new value
 */
export function setConf<
  CONFMODEL extends AnyConfigurationModel,
  const SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | ConfigurationSlotPath<ConfigurationSchemaForModel<CONFMODEL>> =
    ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  target: CONFMODEL | { configuration: CONFMODEL },
  slotPath: SLOT,
  value: unknown,
): void {
  writeConfPath(
    isConfigurationModel(target) ? target : target.configuration,
    typeof slotPath === 'string' ? [slotPath] : (slotPath as string[]),
    value,
  )
}

// through setSlot or setSubschema, whose guards MST's `applyPatch` would skip
function writeConfPath(
  conf: AnyConfigurationModel,
  path: readonly string[],
  value: unknown,
) {
  if (!path.length) {
    throw new Error('setConf needs a slot name or a path to one')
  }
  let node = conf
  for (const segment of path.slice(0, -1)) {
    const child = (node as unknown as Record<string, unknown>)[segment]
    if (!isConfigurationModel(child)) {
      throw new Error(
        `${getType(node).name} has no sub-schema "${segment}", so ${path.join('.')} names nothing to write`,
      )
    }
    node = child
  }
  const leaf = path.at(-1)!
  // off the declaration: a stringArray slot holds an array node too
  const declared = getConfigurationSchemaDefinition(node)?.[leaf]
  if (isConfigurationSchemaType(declared)) {
    // eslint-disable-next-line no-restricted-syntax -- this is setConf
    node.setSubschema(leaf, value)
  } else {
    // eslint-disable-next-line no-restricted-syntax -- this is setConf
    node.setSlot(leaf, value)
  }
}

export interface ConfSettingsReport {
  /** the keys the config declares, written */
  applied: string[]
  /** the keys it does not, with the values the lift left them */
  undeclared: Record<string, unknown>
  /** a declared key whose write threw, and why */
  failed: { key: string; error: string }[]
}

// A sub-schema of independent settings, whose members a bag names one by one.
// A channel — a sub-schema with a shorthand — takes one written value, so a
// bag replaces it whole: `{ field }` after `{ field, domain }` is a facet with
// no domain, and a merge would leave the old domain standing.
function namespaceMetadata(member: unknown) {
  const meta = isStateTreeNode(member)
    ? getConfigurationSchemaMetadata(getType(member))
    : undefined
  return meta?.options.shorthand === undefined ? meta : undefined
}

function writeConfMember(
  conf: AnyConfigurationModel,
  key: string,
  value: unknown,
) {
  const member = conf[key]
  const namespace = isPlainObject(value) ? namespaceMetadata(member) : undefined
  if (namespace) {
    for (const [k, v] of Object.entries(
      preProcessSnapshotWith(namespace, value),
    )) {
      writeConfMember(member, k, v)
    }
  } else {
    writeConfPath(conf, [key], value)
  }
}

/**
 * #api core/configuration
 * Write a settings bag — a session spec's track entry, a share link, an agent
 * call — onto a config. Each key names a member: a slot or a channel is written
 * whole, as `setConf` writes it, so `null` resets it (ADR-146); a namespace's
 * object names members inside it, at any depth, and the ones it leaves out
 * keep their values. The config's own lift and checks run over the bag first,
 * and each namespace's over its part, so a shorthand or a legacy key reads the
 * same here as in `config.json`. A key the config does not declare is reported
 * for the caller to route or refuse, and a declared key whose write throws
 * costs that key alone.
 */
export function applyConfSettings(
  target: AnyConfigurationModel | { configuration: AnyConfigurationModel },
  settings: Record<string, unknown>,
): ConfSettingsReport {
  const conf = isConfigurationModel(target) ? target : target.configuration
  const meta = getConfigurationSchemaMetadata(conf)
  const values = meta ? preProcessSnapshotWith(meta, settings) : settings
  const report: ConfSettingsReport = { applied: [], undeclared: {}, failed: [] }
  for (const [key, value] of Object.entries(values)) {
    const declared = Object.hasOwn(meta?.definition ?? {}, key)
      ? meta!.definition[key]
      : undefined
    if (declared === undefined || isConstantEntry(declared)) {
      report.undeclared[key] = value
      continue
    }
    try {
      writeConfMember(conf, key, value)
      report.applied.push(key)
    } catch (e) {
      report.failed.push({ key, error: `${e}` })
    }
  }
  return report
}
