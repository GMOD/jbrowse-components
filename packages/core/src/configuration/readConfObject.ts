/**
 * @module
 * The config readers: `readConfObject` off a live config node, whose env
 * supplies the jexl instance, and `readConfigValue` off a plain snapshot in a
 * worker or renderer, which is handed one.
 */
import {
  getEnv,
  getSnapshot,
  getType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import { evaluateJexl, isCallbackValue } from './slotValueUtils.ts'

import type { Feature } from '../util/index.ts'
import type { JexlInstance } from '../util/jexlStrings.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSnapshot,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotPath,
  ConfigurationSlotPathValue,
  ConfigurationSlotValue,
} from './types.ts'

function evalConfigCallback(
  expr: string,
  args: Record<string, unknown>,
  confObject: unknown,
) {
  if (!isStateTreeNode(confObject)) {
    throw new Error(
      `cannot evaluate jexl config callback ${JSON.stringify(expr)}: config is a plain snapshot, not a live model (no env to resolve the jexl instance)`,
    )
  }
  const jexl = getEnv<{ pluginManager?: { jexl?: JexlInstance } }>(confObject)
    .pluginManager?.jexl
  if (!jexl) {
    throw new Error(
      `cannot evaluate jexl config callback ${JSON.stringify(expr)}: no pluginManager jexl instance in config env`,
    )
  }
  return evaluateJexl(expr, args, jexl)
}

type ReadableConfig = AnyConfigurationModel | AnyConfigurationSnapshot

function isFeatureField(confObject: ReadableConfig, slotName: string) {
  return (
    isStateTreeNode(confObject) &&
    !!getConfigurationSchemaMetadata(getType(confObject))?.featureFields.has(
      slotName,
    )
  )
}

function readSlot(
  confObject: ReadableConfig,
  slotName: string,
  args: Record<string, unknown>,
) {
  const value = confObject[slotName]
  if (value === undefined) {
    return undefined
  }
  const val =
    isCallbackValue(value) && !isFeatureField(confObject, slotName)
      ? evalConfigCallback(value, args, confObject)
      : value
  if (val === null || typeof val !== 'object') {
    return val
  }
  // the live snapshot, stable across reads so downstream computeds memoize;
  // read-only
  return isStateTreeNode(val) ? getSnapshot(val) : val
}

/**
 * #api core/configuration
 * Read the value at a path of a live config node, such as a track's
 * `configuration`, evaluating a `jexl:` callback with `args`.
 *
 * A snapshot is refused by the types, since a slot at its default is absent
 * from one. A `session.tracks` entry is one (`TrackConfigEntry`): read its
 * `trackId` and `type` directly, and a slot through a helper that supplies the
 * default, such as `getConfAssemblyNamesOrNone`.
 *
 * @param model - instance of ConfigurationSchema
 * @param slotPaths - array of paths to read
 * @param args - extra arguments e.g. for a feature callback,
 *  will be sent to each of the slotNames
 */
export function readConfObject(
  confObject: AnyConfigurationModel,
): AnyConfigurationSnapshot
export function readConfObject<
  CONFMODEL extends AnyConfigurationModel,
  const SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | ConfigurationSlotPath<ConfigurationSchemaForModel<CONFMODEL>> =
    ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  confObject: CONFMODEL,
  slotPath?: SLOT,
  args?: Record<string, unknown>,
): SLOT extends string
  ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
  : ConfigurationSlotPathValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
// No looser overload admits the model: a catch-all lets a slot-name typo
// compile as `any`.
export function readConfObject(
  confObject: ReadableConfig,
  slotPath?: string | string[],
  args: Record<string, unknown> = {},
): any {
  if (typeof slotPath === 'string') {
    return readSlot(confObject, slotPath, args)
  }
  if (slotPath !== undefined && !Array.isArray(slotPath)) {
    throw new TypeError('slotPath must be a string or array')
  }
  if (!slotPath?.length) {
    return isStateTreeNode(confObject) ? getSnapshot(confObject) : confObject
  }
  let conf: ReadableConfig = confObject
  for (let i = 0; i < slotPath.length - 1; i++) {
    const subConf = conf[slotPath[i]!]
    if (subConf === undefined) {
      return undefined
    }
    conf = subConf
  }
  return readSlot(conf, slotPath[slotPath.length - 1]!, args)
}

function resolveConfigValue(
  config: Record<string, unknown>,
  key: string | string[],
) {
  if (Array.isArray(key)) {
    let val: unknown = config
    for (const k of key) {
      val = (val as Record<string, unknown> | null | undefined)?.[k]
    }
    return val
  }
  return config[key]
}

/**
 * Read a value from a plain config snapshot, evaluating a `jexl:` callback
 * against `feature`. For rendering code and workers; pass the realm's
 * `pluginManager.jexl` so plugin-registered functions resolve.
 */
export function readConfigValue<T>(
  config: Record<string, unknown>,
  key: string | string[],
  feature: Feature,
  jexl: JexlInstance,
) {
  return evaluateForFeature(resolveConfigValue(config, key), feature, jexl) as T
}

/**
 * #api core/configuration
 * A config value as `feature` reads it: a `jexl:` callback evaluated against
 * the feature, anything else as written.
 */
export function evaluateForFeature(
  value: unknown,
  feature: Feature,
  jexl: JexlInstance,
) {
  return isCallbackValue(value) ? evaluateJexl(value, { feature }, jexl) : value
}
