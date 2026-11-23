import { isRecord } from './liftConfig.ts'

import type { ConfigManifest } from './types.ts'

type Schema = Record<string, unknown>

/**
 * The types a plugin registers beside core's, in the manifest's own groups,
 * and the top-level keys its `rootConfigurationSchema` adds: what
 * `scripts/generateConfigManifest.ts --plugin <bundle> --out <file>` writes
 * from the plugin's built ESM bundle, or `--umd-plugin` from its UMD bundle,
 * each a path or a url.
 */
export interface PluginManifest extends Partial<
  Pick<
    ConfigManifest,
    | 'adapters'
    | 'tracks'
    | 'displays'
    | 'textSearchAdapters'
    | 'connections'
    | 'internetAccounts'
    | 'views'
  >
> {
  /** The bundles it was read from. */
  plugins?: string[]
  /** The JBrowse version whose core it was read beside. */
  jbrowse?: string
  /**
   * The config JSON Schema's parts the plugin adds or changes: the top-level
   * keys its `rootConfigurationSchema` declares, its own type definitions, and
   * core's unions (`Track`, `Display`, `RootConfiguration`, ...) with its types
   * among their branches and properties.
   */
  schema: {
    properties?: Record<string, Schema>
    $defs: Record<string, Schema>
  }
}

function isPluginManifest(value: unknown): value is PluginManifest {
  return (
    isRecord(value) && isRecord(value.schema) && isRecord(value.schema.$defs)
  )
}

/** A parsed manifest file, refused when it is not one, as a config.json is not. */
export function pluginManifestOf(value: unknown, file: string) {
  if (isPluginManifest(value)) {
    return value
  }
  throw new Error(
    `${file} is not a plugin manifest: it has no schema.$defs. generateConfigManifest.ts --plugin writes one`,
  )
}

function merged<T extends object>(core: T, extra: readonly (T | undefined)[]) {
  const all = { ...core }
  for (const group of extra) {
    Object.assign(all, group)
  }
  return all
}

/** The core manifest with each plugin manifest's types beside its own. */
export function withPluginManifests(
  core: ConfigManifest,
  plugins: readonly PluginManifest[],
): ConfigManifest {
  return {
    ...core,
    adapters: merged(
      core.adapters,
      plugins.map(p => p.adapters),
    ),
    tracks: merged(
      core.tracks,
      plugins.map(p => p.tracks),
    ),
    displays: merged(
      core.displays,
      plugins.map(p => p.displays),
    ),
    textSearchAdapters: merged(
      core.textSearchAdapters,
      plugins.map(p => p.textSearchAdapters),
    ),
    connections: merged(
      core.connections,
      plugins.map(p => p.connections),
    ),
    internetAccounts: merged(
      core.internetAccounts,
      plugins.map(p => p.internetAccounts),
    ),
    views: merged(
      core.views,
      plugins.map(p => p.views),
    ),
  }
}

function withoutRepeats(branches: unknown[]) {
  return [...new Map(branches.map(b => [JSON.stringify(b), b])).values()]
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function hintOf(type: unknown) {
  const [hint] = isRecord(type) ? listOf(type.anyOf) : []
  return isRecord(hint) ? hint : {}
}

// A union's `type` property hints the names registered in its first branch,
// which the plugins' names join rather than replace.
function mergedTypeProperty(existing: unknown, plugin: Schema) {
  const [hint, ...rest] = listOf(plugin.anyOf)
  return isRecord(hint) && Array.isArray(hint.enum)
    ? {
        ...plugin,
        anyOf: [
          {
            ...hint,
            enum: [
              ...new Set([
                ...listOf(hintOf(existing).enum),
                ...listOf(hint.enum),
              ]),
            ],
          },
          ...rest,
        ],
      }
    : plugin
}

// A union's branches and an object's properties gather across plugins, so two
// plugins' types land in one `Display`; any other definition is the plugin's.
function mergedDefinition(existing: unknown, plugin: Schema): Schema {
  return isRecord(existing)
    ? {
        ...plugin,
        ...(Array.isArray(existing.allOf) && Array.isArray(plugin.allOf)
          ? { allOf: withoutRepeats(existing.allOf.concat(plugin.allOf)) }
          : {}),
        ...(isRecord(existing.properties) && isRecord(plugin.properties)
          ? {
              properties: {
                ...existing.properties,
                ...plugin.properties,
                ...(isRecord(plugin.properties.type)
                  ? {
                      type: mergedTypeProperty(
                        existing.properties.type,
                        plugin.properties.type,
                      ),
                    }
                  : {}),
              },
            }
          : {}),
      }
    : plugin
}

/** The core config JSON Schema with each plugin manifest's definitions merged in. */
export function withPluginSchemas(
  core: Schema,
  plugins: readonly PluginManifest[],
): Schema {
  const properties: Schema = {
    ...(isRecord(core.properties) ? core.properties : {}),
  }
  const defs: Schema = { ...(isRecord(core.$defs) ? core.$defs : {}) }
  for (const plugin of plugins) {
    Object.assign(properties, plugin.schema.properties)
    for (const [name, definition] of Object.entries(plugin.schema.$defs)) {
      defs[name] = mergedDefinition(defs[name], definition)
    }
  }
  return { ...core, properties, $defs: defs }
}
