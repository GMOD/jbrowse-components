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
  | UMDLocPluginDefinition
  | UMDUrlPluginDefinition

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
  | ESMLocPluginDefinition
  | ESMUrlPluginDefinition

export interface CJSPluginDefinition {
  cjsUrl: string
  name?: string
}

/**
 * A plugin named by its plugin-store package rather than by a url — the query
 * ("msaview, for this JBrowse") instead of a precomputed answer ("these exact
 * bytes"). `resolveStorePluginRefs` (util/pluginStore.ts) turns one into a
 * concrete, version-pinned, integrity-carrying definition against the published
 * manifest, so a definition in this shape never reaches PluginLoader.
 *
 * It exists for the population nobody can revisit. A config at a permanent url
 * — jbrowse.org/ucsc/hg38, the ~50k genark hubs — names its plugins once and is
 * then read for years by whatever JBrowse loads it. A url there is an answer
 * computed on the day the config was generated, and the only answer that keeps
 * working is the store's mutable `latest/` path: no integrity hash, and the same
 * bytes for every host. A package name defers both decisions to load time.
 */
export interface StorePluginDefinition {
  storePlugin: string
  name?: string
}

/**
 * `storePlugin` also rides along on the url-bearing forms, in both directions.
 * A config can carry a ref *and* a url — the ref for a JBrowse that resolves it,
 * the url for one that does not — which is what lets a config generator start
 * emitting refs before every host reading it understands them. And resolution
 * keeps the field on what it produces, so a resolved definition still records
 * which store entry it came from and `samePlugin` can match it against a ref.
 */
export type PluginDefinition = (
  | UMDUrlPluginDefinition
  | UMDLocPluginDefinition
  | LegacyUMDPluginDefinition
  | ESMLocPluginDefinition
  | ESMUrlPluginDefinition
  | CJSPluginDefinition
  | StorePluginDefinition
) & { storePlugin?: string }

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

/**
 * Whether a definition names a store entry to resolve. Deliberately not part of
 * the CJS/ESM/UMD trio `assertSingleKind` counts: those are loaders, and a ref
 * is not one. A ref names *which plugin*, and pairing it with a url is the
 * supported migration shape rather than the two-loaders ambiguity that guard
 * exists to refuse.
 */
export function isStorePluginDefinition(
  def: PluginDefinition,
): def is PluginDefinition & { storePlugin: string } {
  return 'storePlugin' in def && typeof def.storePlugin === 'string'
}

/** The store package a definition names, resolved or not. */
export function storePluginPackage(def: PluginDefinition) {
  return isStorePluginDefinition(def) ? def.storePlugin : undefined
}

// Plugins that used to ship as external config `plugins[]` entries but are now
// bundled into the jbrowse-web/desktop core build. Remote configs on jbrowse.org
// still list them, so we drop those entries before loading: core already
// registers the same elements (and wins, since core plugins register first), and
// skipping the external copy avoids a redundant network fetch plus a flurry of
// "already registered" console warnings. Matched on the config-level `name`
// (the external plugin's UMD-global name, e.g. "MafViewer"/"GWAS"), not the core
// class name — so this runs AFTER `resolveStorePluginRefs`, which is where a
// store ref acquires the name to match on. Run it before, and a config naming a
// vendored plugin by package slips through and installs a second copy beside
// core's. Apply only in products whose core bundle actually vendors these —
// not globally — so CLI indexing, @jbrowse/img, and react-circular (which don't
// bundle them) still load the external plugin. Also drives the plugin store,
// which hides these so a user can't install a colliding second copy
// (`installablePlugins`, util/pluginStore.ts).
export const vendoredPluginNames = new Set(['MafViewer', 'GWAS'])

/**
 * Desktop's half of the same list — a plugin one product bundles and another does
 * not, which the shared set above cannot express.
 *
 * Blat is in Desktop's corePlugins but deliberately not Web's: Web is where
 * cold-load bundle size is paid, and BLAT is niche. So Desktop's bundled copy is
 * the only one that ships. It is what gives BLAT on a genome the user opened
 * from their own disk, where no config names any plugin, and it is the copy that
 * reaches UCSC through the main-process `blatFetch` bridge and the CAPTCHA-solve
 * window. Web has to load the external entry to have BLAT at all.
 *
 * Naming it drops a config's `plugins[]` entry for Blat before Desktop's loader
 * sees it, so a config that carries one does not install a second copy beside
 * the bundled one and append its Tools menu items twice. Nothing carries one
 * today: jb2hubs stamps `sequence.metadata.blatDb`, which names the UCSC db an
 * assembly is searchable under and says nothing about loading a plugin. The
 * entry is a guard for the UMD build (`plugins/blat/scripts/build-umd.ts`),
 * which a config can name and which is how Web would pick BLAT up.
 *
 * It lives here beside the shared set rather than in jbrowse-desktop because the
 * two are read together — a surface consulting one and not the other offers an
 * install the loader then drops, which is what Desktop's plugin store and global
 * plugins dialog both did.
 */
export const desktopVendoredPluginNames = ['Blat']

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
  } else if (isStorePluginDefinition(d)) {
    // an unresolved ref, which is what a resolution failure is reported on: it
    // has no url yet, so the package name is the only thing that identifies it
    return `store plugin ${d.storePlugin}`
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

/**
 * Whether a definition loads from exactly `url` — the question behind "which
 * definition is this loaded plugin", "is this one in the session's list", "which
 * entry does an uninstall remove".
 *
 * The two undefined guards are the whole point, and both were live as
 * `pluginUrl(d) === url` comparisons. A definition naming no loader reads back as
 * the literal `'unknown url'`, so any two of them compared equal: approving one
 * marked every other unloadable definition trusted, and removing one filtered
 * every other unloadable one out of the config. And the url side is absent for a
 * core or global plugin (no install url was recorded), which must match no
 * definition rather than the first url-less one.
 */
export function isPluginUrl(d: PluginDefinition, url: string | undefined) {
  const actual = maybePluginUrl(d)
  return actual !== undefined && actual === url
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
 * identical — a UMD name+url in a config, an esmUrl in the global list, a store
 * ref in one and the pinned definition it resolves to in the other — so a
 * shared store package, a shared name, or a shared url is each enough. All
 * three are optional (an ESM definition carries no name, an unloadable one no
 * url, a hand-written one no package), and a missing field never matches: two
 * definitions are not the same plugin just because neither names one.
 *
 * The store package is checked first because it is the only one of the three
 * that survives resolution intact. A ref and its resolved form share it; they
 * share no url, and a *pure* ref has no name until the manifest supplies one.
 *
 * This is the single answer to "is this plugin already installed" — dedupe
 * across plugin sources, the plugin store's installed-check — so those cannot
 * drift apart and disagree about what is a duplicate.
 */
export function samePlugin(a: PluginDefinition, b: PluginDefinition) {
  const [pkgA, pkgB] = [storePluginPackage(a), storePluginPackage(b)]
  const [nameA, nameB] = [pluginName(a), pluginName(b)]
  const [urlA, urlB] = [maybePluginUrl(a), maybePluginUrl(b)]
  return (
    (pkgA !== undefined && pkgA === pkgB) ||
    (nameA !== undefined && nameA === nameB) ||
    (urlA !== undefined && urlA === urlB)
  )
}

/**
 * The candidates no definition in `existing` already describes — `dedupePlugins`
 * across two lists whose first one is already settled, for a source loaded after
 * another rather than merged with it.
 */
export function pluginsNotIn(
  candidates: PluginDefinition[],
  existing: PluginDefinition[],
) {
  return candidates.filter(c => !existing.some(e => samePlugin(e, c)))
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
