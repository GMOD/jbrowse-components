import type { ConfigManifest } from './types.ts'

type Schema = Record<string, unknown>

/**
 * The types a plugin registers beside core's, in the manifest's own groups:
 * what `scripts/generateConfigManifest.ts --plugin <bundle> --out <file>`
 * writes from the plugin's built ESM bundle.
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
   * The config JSON Schema's definitions the plugin adds or changes: its own
   * types, and core's unions (`Track`, `Display`, `RootConfiguration`, ...)
   * with its types among their branches and properties.
   */
  schema?: { $defs: Record<string, Schema> }
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

function isRecord(value: unknown): value is Schema {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withoutRepeats(branches: unknown[]) {
  return [...new Map(branches.map(b => [JSON.stringify(b), b])).values()]
}

// A union's branches and an object's properties gather across plugins, so two
// plugins' types land in one `Display`; any other definition is the plugin's.
function mergedDefinition(existing: unknown, plugin: Schema): Schema {
  return isRecord(existing)
    ? {
        ...plugin,
        ...(Array.isArray(existing.allOf) && Array.isArray(plugin.allOf)
          ? { allOf: withoutRepeats([...existing.allOf, ...plugin.allOf]) }
          : {}),
        ...(isRecord(existing.properties) && isRecord(plugin.properties)
          ? { properties: { ...existing.properties, ...plugin.properties } }
          : {}),
      }
    : plugin
}

/** The core config JSON Schema with each plugin manifest's definitions merged in. */
export function withPluginSchemas(
  core: Schema,
  plugins: readonly PluginManifest[],
): Schema {
  const defs: Schema = { ...(isRecord(core.$defs) ? core.$defs : {}) }
  for (const plugin of plugins) {
    for (const [name, definition] of Object.entries(
      plugin.schema?.$defs ?? {},
    )) {
      defs[name] = mergedDefinition(defs[name], definition)
    }
  }
  return { ...core, $defs: defs }
}
