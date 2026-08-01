/**
 * What a plugin definition is, and everything that can be answered by looking
 * at one — its url, its name, whether two describe the same plugin.
 *
 * Kept apart from PluginLoader, which pulls in ReExports (effectively all of
 * core) to be able to run a plugin. Inspecting a definition must not cost that:
 * the plugin store resolves definitions and would otherwise import core's
 * config layer back into itself.
 */

export interface UMDLocPluginDefinition {
  umdLoc: {
    uri: string
    baseUri?: string
  }
  name: string
  integrity?: string
}

export interface UMDUrlPluginDefinition {
  umdUrl: string
  name: string
  integrity?: string
}

export interface LegacyUMDPluginDefinition {
  url: string
  name: string
  integrity?: string
}

export type UMDPluginDefinition =
  UMDLocPluginDefinition | UMDUrlPluginDefinition

export interface ESMLocPluginDefinition {
  esmLoc: {
    uri: string
    baseUri?: string
  }
  name?: string
}

export interface ESMUrlPluginDefinition {
  esmUrl: string
  name?: string
}

export type ESMPluginDefinition =
  ESMLocPluginDefinition | ESMUrlPluginDefinition

export interface CJSPluginDefinition {
  cjsUrl: string
  name?: string
}

export type PluginDefinition =
  | UMDUrlPluginDefinition
  | UMDLocPluginDefinition
  | LegacyUMDPluginDefinition
  | ESMLocPluginDefinition
  | ESMUrlPluginDefinition
  | CJSPluginDefinition

export function isUMDPluginDefinition(
  def: PluginDefinition,
): def is UMDPluginDefinition | LegacyUMDPluginDefinition {
  return 'umdUrl' in def || 'url' in def || 'umdLoc' in def
}

export function isESMPluginDefinition(
  def: PluginDefinition,
): def is ESMPluginDefinition {
  return 'esmUrl' in def || 'esmLoc' in def
}

export function isCJSPluginDefinition(
  def: PluginDefinition,
): def is CJSPluginDefinition {
  return 'cjsUrl' in def
}

// Plugins that used to ship as external config `plugins[]` entries but are now
// bundled into the jbrowse-web/desktop core build. Remote configs on jbrowse.org
// still list them, so we drop those entries before loading: core already
// registers the same elements (and wins, since core plugins register first), and
// skipping the external copy avoids a redundant network fetch plus a flurry of
// "already registered" console warnings. Matched on the config-level `name`
// (the external plugin's UMD-global name, e.g. "MafViewer"/"GWAS"), not the core
// class name. Apply only in products whose core bundle actually vendors these —
// not globally — so CLI indexing, @jbrowse/img, and react-circular (which don't
// bundle them) still load the external plugin. Also drives the plugin store,
// which hides these so a user can't install a colliding second copy.
export const vendoredPluginNames = new Set(['MafViewer', 'GWAS'])

/**
 * `alsoVendored` is for a plugin one product bundles and another does not, which
 * the shared set above cannot express: Desktop vendors Blat (so a hub config
 * naming it must be dropped, or its menu items are appended twice — once by the
 * core copy, once by the downloaded one), while Web does not and has to load
 * exactly that entry to have BLAT at all.
 */
export function dropVendoredPlugins(
  defs: PluginDefinition[],
  alsoVendored: Iterable<string> = [],
) {
  const vendored = new Set([...vendoredPluginNames, ...alsoVendored])
  return defs.filter(d => !(isUMDPluginDefinition(d) && vendored.has(d.name)))
}

// The two functions below describe a definition by picking the one url it will
// be loaded from, so both dispatch in loadPlugin's order — CJS, then ESM, then
// UMD. Keep them in step with it: they are what the plugin trust gate
// (checkPlugins) reads and what the untrusted-plugin prompt shows, so an order
// that disagrees with the loader's vets one url and executes another. They once
// did disagree, and a definition carrying both `umdUrl` and `cjsUrl` was
// approved on its jbrowse.org umd url while loadPlugin require()d its cjs one.
// assertSingleKind now rejects such a definition outright; this order is the
// second half of that guarantee, since the gate runs before the loader does.
export function pluginDescriptionString(d: PluginDefinition) {
  if (isCJSPluginDefinition(d)) {
    return `CJS plugin ${d.cjsUrl}`
  } else if (isESMPluginDefinition(d)) {
    return `ESM plugin ${'esmUrl' in d ? d.esmUrl : d.esmLoc.uri}`
  } else if (isUMDPluginDefinition(d)) {
    return `UMD plugin ${d.name}`
  } else {
    return 'unknown plugin'
  }
}

/**
 * The url a definition loads from, or undefined when it names no loader at all.
 * Comparisons between definitions go through this rather than `pluginUrl`, whose
 * 'unknown url' placeholder is display text: two unloadable definitions are not
 * the same plugin just because neither has a url.
 */
export function maybePluginUrl(d: PluginDefinition) {
  if (isCJSPluginDefinition(d)) {
    return d.cjsUrl
  } else if (isESMPluginDefinition(d)) {
    return 'esmUrl' in d ? d.esmUrl : d.esmLoc.uri
  } else if (isUMDPluginDefinition(d)) {
    return 'umdLoc' in d ? d.umdLoc.uri : 'umdUrl' in d ? d.umdUrl : d.url
  } else {
    return undefined
  }
}

export function pluginUrl(d: PluginDefinition) {
  return maybePluginUrl(d) ?? 'unknown url'
}

export function pluginName(definition: PluginDefinition) {
  return 'name' in definition ? definition.name : undefined
}

export function pluginDefinitionMetadata(definition: PluginDefinition) {
  return {
    name: pluginName(definition),
    url: pluginUrl(definition),
  }
}

export function pluginLabel(definition: PluginDefinition) {
  const name = pluginName(definition)
  return name ? `${name} (${pluginUrl(definition)})` : pluginUrl(definition)
}

/**
 * Whether two definitions describe the same plugin. They can without being
 * identical — a UMD name+url in a config, an esmUrl in the global list — so
 * either a shared name or a shared url is enough. Both are optional (an ESM
 * definition carries no name, an unloadable one no url), and a missing field
 * never matches: two definitions are not the same plugin just because neither
 * names one.
 *
 * This is the single answer to "is this plugin already installed" — dedupe
 * across plugin sources, the plugin store's installed-check — so those cannot
 * drift apart and disagree about what is a duplicate.
 */
export function samePlugin(a: PluginDefinition, b: PluginDefinition) {
  const [nameA, nameB] = [pluginName(a), pluginName(b)]
  const [urlA, urlB] = [maybePluginUrl(a), maybePluginUrl(b)]
  return (
    (nameA !== undefined && nameA === nameB) ||
    (urlA !== undefined && urlA === urlB)
  )
}

/**
 * Drops later definitions that name a plugin an earlier one already did, so the
 * first source listed wins: a config's own (version-pinned) entry takes
 * precedence over the same plugin from the user's global list.
 */
export function dedupePlugins(plugins: PluginDefinition[]) {
  const kept: PluginDefinition[] = []
  for (const plugin of plugins) {
    if (!kept.some(k => samePlugin(k, plugin))) {
      kept.push(plugin)
    }
  }
  return kept
}
