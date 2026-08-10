/**
 * @module
 * The config **readers**: `readConfObject` off a live MST config node,
 * `readConfigValue` off a plain snapshot object in a worker or a renderer, and
 * `readConfSlot` for the callers that hold either and don't know which. All
 * three exist to evaluate a slot's `jexl:...` callback on read; they differ only
 * in where the jexl instance comes from (the node's env vs. an explicit
 * argument) and in how much of that they are willing to decide at runtime.
 */
import {
  getEnv,
  getSnapshot,
  getType,
  isMapType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import { evaluateJexl, isCallbackValue } from './slotValueUtils.ts'

import type { Feature } from '../util/index.ts'
import type { JexlInstance } from '../util/jexlStrings.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  AnyConfigurationSnapshot,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
} from './types.ts'
import type { IMSTMap } from '@jbrowse/mobx-state-tree'

// Whether a read supplied anything for a callback to be about. `for...in`
// rather than `Object.keys().length`, to stop at the first key instead of
// allocating an array on a path that every callback read takes.
function hasContext(args: Record<string, unknown>) {
  for (const _ in args) {
    return true
  }
  return false
}

// Evaluate a slot's `jexl:...` callback string against the realm's single jexl
// instance (carrying plugin-registered functions), read from the config node's
// env. readConfObject only ever operates on live MST configs — nested sub-config
// reads stay MST (env resolves to the root), and frozen track configs hydrate to
// MST before any callback is read — so the env instance is always present here.
function evalConfigCallback(
  expr: string,
  args: Record<string, unknown>,
  confObject: unknown,
) {
  if (!isStateTreeNode(confObject)) {
    // A jexl slot needs the realm's jexl instance, which is read from a live
    // config node's env. A plain config snapshot (e.g. an un-hydrated
    // session.tracks entry) carries no env — read it through a hydrated model,
    // or use readConfigValue(config, key, feature, jexl) which takes jexl
    // explicitly.
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

// A config readable by readConfObject: a live schema model, a plain config
// snapshot (an un-hydrated session.tracks entry, etc.), or a top-level
// types.map of sub-schemas (e.g. an assembly's per-key configs) whose entries
// are reachable via `.get()` rather than property access.
type ReadableConfig =
  | AnyConfigurationModel
  | AnyConfigurationSnapshot
  | IMSTMap<AnyConfigurationSchemaType>

function isConfigMap(
  confObject: ReadableConfig,
): confObject is IMSTMap<AnyConfigurationSchemaType> {
  return isStateTreeNode(confObject) && isMapType(getType(confObject))
}

// Read a slot's raw stored value, drilling into a map entry via `.get()` when
// the config is itself a types.map.
function rawSlotValue(confObject: ReadableConfig, slotName: string) {
  return isConfigMap(confObject)
    ? confObject.get(slotName)
    : confObject[slotName]
}

// Read and resolve a single slot: raw value, jexl callback evaluation, then a
// referentially-stable snapshot for sub-config nodes.
function readSlot(
  confObject: ReadableConfig,
  slotName: string,
  args: Record<string, unknown>,
) {
  // strict undefined check, not truthiness — a slot value can legitimately be
  // falsy (0, '', false, null)
  const value = rawSlotValue(confObject, slotName)
  if (value === undefined) {
    return undefined
  }
  // A callback read with no context is not an evaluation, so don't perform one:
  // hand back the expression.
  //
  // `args` is an optional parameter, which is the whole problem. `readConfObject`
  // does two different jobs — "what is this setting" and "what is this setting
  // FOR this feature" — and the only thing distinguishing them at a call site is
  // whether someone passed a third argument. Omit it on a `jexl:` slot and the
  // expression was evaluated anyway, against a context where every name it
  // mentions is `undefined`, and the fallout was returned as if it were the
  // setting. `feature.name` is `undefined`; `split(undefined,'#')` is `['']`;
  // the multi-row display shipped that `''` to the worker as an attribute name
  // and drew every feature in one unnamed row. The Manhattan plot lost
  // per-point coloring the same way. LinearBasicDisplay and renderConfig.ts
  // had each already worked around it locally, four times between them.
  //
  // Deliberately keyed on `args` being empty rather than on the slot's declared
  // `contextVariable`: that declaration is config-editor metadata, and making
  // correctness depend on it would mean a slot that forgot to declare it —
  // `partitionField` did — silently goes back to being wrong. Emptiness needs
  // nothing to be declared and nothing to be maintained.
  //
  // The expression is what every deferred consumer already expects, because
  // forwarding one is the normal case: `readConfigValue`, `makeColorEvaluator`,
  // `makeFeaturePartitionResolver` and `getScoreTransform` all test
  // `isJexl`/`isCallbackValue` first and evaluate with a feature in hand. This
  // only brings the slot-at-a-time read in line with the wholesale snapshot
  // path, which never had the bug — `fullConfSnapshot` reads raw properties and
  // so has always forwarded expressions intact (CONFIG_PATTERN.md, "the
  // snapshot keeps raw jexl strings").
  //
  // Note what this does NOT fix: a call site still can't say which of the two
  // jobs it wants, so a read that means "resolve this" and forgets its feature
  // now gets an expression instead of nonsense. Better failure, same ambiguity.
  // Splitting the reader in two is the real repair — agent-docs/TODO.md.
  const val =
    isCallbackValue(value) && hasContext(args)
      ? evalConfigCallback(value, args, confObject)
      : value
  // Fast path for primitives (most common case)
  if (val === null || typeof val !== 'object') {
    return val
  }
  // Return the live, referentially-stable snapshot (frozen in dev) rather than
  // a per-read clone: stable identity lets downstream computeds memoize, and
  // the old structuredClone was both a hot-path allocation and a source of
  // spurious recomputation. Treat as read-only.
  return isStateTreeNode(val) ? getSnapshot(val) : val
}

/**
 * #api core/configuration
 * Given a configuration model (an instance of a ConfigurationSchema), read the
 * configuration value at the given path. Use this when you hold the
 * configuration model directly, e.g. an entry from `session.tracks`.
 *
 * Wants a **live config node**, not a snapshot of one, and passing a snapshot is
 * a type error. Slots are built with `types.stripDefault`, so a slot sitting at
 * its default is absent from a snapshot — "unset" and "at its default" are
 * indistinguishable there, and a read off one reports a default as missing.
 *
 * That is enforced in the types only, deliberately: it can't be a runtime check.
 * `generateHierarchy` reads slots straight off the **un-hydrated frozen** entries
 * of `jbrowse.tracks` on purpose, because hydrating every track to answer the
 * track selector is what `types.frozen` exists to avoid — and those reads are
 * indistinguishable at runtime from the broken spelling.
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
  SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  confObject: CONFMODEL,
  slotPath?: SLOT,
  args?: Record<string, unknown>,
): SLOT extends string
  ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
  : any
// A top-level types.map of sub-schemas (e.g. an assembly's per-key configs)
// carries no resolvable schema type, so slot names/values aren't checked
// (returns any); rawSlotValue falls back to map.get() for these. Deliberately
// admits ONLY the map — not `AnyConfigurationModel`, and not
// `AnyConfigurationSnapshot` (see the doc comment above). Admitting the model
// here made this overload a catch-all: a slot-name typo failed overload 2's
// `ConfigurationSlotName` constraint, fell through to here, and compiled clean
// as `any`. That is the whole reason `readConfObject` used to be the looser
// reader of the pair; it is now exactly as strict as `getConf`.
export function readConfObject(
  confObject: IMSTMap<AnyConfigurationSchemaType>,
  slotPath?: string | string[],
  args?: Record<string, unknown>,
): any
// loose implementation signature: the body returns values that are `any` by
// nature (raw slot values, snapshots); the typed overload above is what callers
// see.
export function readConfObject(
  confObject: ReadableConfig,
  slotPath?: string | string[],
  args: Record<string, unknown> = {},
): any {
  // the single-slot read, first and allocation-free: it is the shape of nearly
  // every one of the ~1300 call sites, so it doesn't get normalized into a
  // one-element array on the way past
  if (typeof slotPath === 'string') {
    return readSlot(confObject, slotPath, args)
  }
  if (slotPath !== undefined && !Array.isArray(slotPath)) {
    throw new TypeError('slotPath must be a string or array')
  }
  // No path, or an empty one — which means the same thing, and used not to: `[]`
  // is truthy, so it reached the walk below and read `confObject[undefined]`.
  //
  // Returns the whole config as a plain object: the live, referentially-stable
  // snapshot (frozen in dev), not a fresh clone — treat as read-only.
  if (!slotPath?.length) {
    return isStateTreeNode(confObject) ? getSnapshot(confObject) : confObject
  }
  // every segment but the last names a sub-config, and only the last is a slot
  // read — which is where jexl evaluation and snapshotting happen, and nowhere
  // else. Iterative rather than a self-call per segment, which re-entered the
  // whole argument-shape preamble above at each level.
  let conf: ReadableConfig = confObject
  for (let i = 0; i < slotPath.length - 1; i++) {
    const subConf = rawSlotValue(conf, slotPath[i]!)
    if (subConf === undefined) {
      return undefined
    }
    conf = subConf
  }
  return readSlot(conf, slotPath[slotPath.length - 1]!, args)
}

// The plain-object half of the slot walk, shared by readConfigValue and
// readConfSlot. The MST half is readSlot/rawSlotValue above. A plain object has
// no map entries and no sub-config nodes to snapshot, so it is just a path
// reduce.
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
 * Read a value from a plain config snapshot object. Automatically evaluates
 * "jexl:..." strings per-feature. Works without MST — intended for use in
 * rendering code (GPU, Canvas2D, workers). Pass the realm's `pluginManager.jexl`
 * so plugin-registered functions (e.g. in a custom `mouseover` slot) resolve.
 */
export function readConfigValue<T>(
  config: Record<string, unknown>,
  key: string | string[],
  feature: Feature,
  jexl: JexlInstance,
) {
  const raw = resolveConfigValue(config, key)
  return (
    isCallbackValue(raw) ? evaluateJexl(raw, { feature }, jexl) : raw
  ) as T
}

/**
 * #api core/configuration
 * Read a single config slot from a config that may be **either** a live MST
 * node or a plain snapshot object, evaluating the value if it is a `jexl:`
 * expression. For the dialogs and panels that are handed a track config without
 * knowing which of the two they got. An About panel gets a hydrated track
 * config from the session and a bare object from an embedded caller.
 *
 * Reach for `readConfObject` or `readConfigValue` when the shape is known:
 * this one decides at runtime, and the plain branch inherits the snapshot
 * caveat (a slot at its default is absent from a snapshot, so it reads
 * `undefined`).
 *
 * @param config - live config model or plain config object
 * @param slotPath - slot name, or path of sub-config names ending in a slot
 * @param args - extra arguments for a callback slot, e.g. `{ feature }`
 * @param jexl - realm jexl instance, required only to evaluate a callback slot
 *  on a plain object (a live node resolves its own from env)
 */
export function readConfSlot<T = unknown>(
  config: AnyConfigurationModel | Record<string, unknown>,
  slotPath: string | string[],
  args: Record<string, unknown> = {},
  jexl?: JexlInstance,
): T {
  if (isStateTreeNode(config)) {
    // pass slotPath through rather than normalizing a string into a one-element
    // array: readConfObject keeps the single-slot read allocation-free
    return readConfObject(config, slotPath, args) as T
  }
  const value = resolveConfigValue(config, slotPath)
  // A plain-object config has no MST env, so the realm's jexl instance can't be
  // resolved automatically — callers reading a callback slot must pass it. Only
  // reached when the slot actually holds a `jexl:` value (trackId/adapter/etc.
  // never do), so non-callback readers need not supply it.
  if (isCallbackValue(value)) {
    if (!jexl) {
      throw new Error(
        `cannot evaluate jexl config slot ${JSON.stringify(slotPath)} on a plain-object config: no jexl instance provided`,
      )
    }
    return evaluateJexl(value, args, jexl) as T
  }
  return value as T
}
