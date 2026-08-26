import { compareVersions, satisfies } from 'compare-versions'

import { fetchPlugins } from '../checkPlugins.ts'
import {
  desktopVendoredPluginNames,
  isStorePluginDefinition,
  maybePluginUrl,
  samePlugin,
  storePluginName,
  vendoredPluginNames,
} from '../pluginDefinitions.ts'

import type { PluginDefinition } from '../pluginDefinitions.ts'
import type { JBrowsePlugin, JBrowsePluginVersion } from './types/data.ts'

// The url-bearing fields shared by a JBrowsePlugin and a JBrowsePluginVersion.
type UrlFields = Pick<
  JBrowsePlugin,
  'url' | 'umdUrl' | 'esmUrl' | 'cjsUrl' | 'integrity'
>

// Every build an entry publishes: the top-level one plus each version-pinned
// one, which is the same set resolvePlugin picks from.
function publishedBuilds(plugin: JBrowsePlugin): UrlFields[] {
  return [plugin, ...(plugin.versions ?? [])]
}

/**
 * The store entries a product can install at all, before any user filter. Both
 * surfaces that list the store go through this — the in-session plugin store
 * widget and Desktop's global plugins dialog — because an entry one of them
 * offers and the loader behind the other drops is a silent install: the button
 * says Installed (or stays live, and every click appends another dead entry) and
 * nothing about the running app changes.
 *
 * Two independent reasons to hide an entry:
 *
 * - **No build this product can load.** Web runs ESM/UMD; a CJS-only entry needs
 *   Node's `require`, so only Desktop can install it. Asked of every build the
 *   entry publishes rather than only the top-level urls — an entry that pins urls
 *   per version, which `resolvePlugin`'s fallback exists to accommodate, used to
 *   vanish from Web's list with no diagnostic. An entry whose *resolved* build is
 *   the CJS-only one is still shown, since that is a fact about this JBrowse
 *   version rather than about the product, and PluginStoreCard already has a
 *   place to say so.
 * - **Already vendored into this product's core bundle**, where installing does
 *   nothing because `dropVendoredPlugins` drops the definition at load. Desktop's
 *   half of that list counts too, and is the half both surfaces were missing.
 */
export function installablePlugins(
  plugins: JBrowsePlugin[],
  isElectron: boolean,
) {
  const vendored = new Set([
    ...vendoredPluginNames,
    ...(isElectron ? desktopVendoredPluginNames : []),
  ])
  return plugins.filter(
    plugin =>
      !vendored.has(plugin.name) &&
      (isElectron ||
        publishedBuilds(plugin).some(b => b.esmUrl ?? b.url ?? b.umdUrl)),
  )
}

export interface ResolvedPlugin {
  // false when the plugin declares versions but none support the running JBrowse
  compatible: boolean
  // the chosen published plugin version, when selected from versions[]
  pluginVersion?: string
  // every JBrowse range the plugin declares, for messaging when incompatible
  supportedRanges: string[]
  // the concrete, installable definition for the chosen url, or undefined when
  // the entry offers no url to install from — a store entry whose urls are all
  // per-version has nothing to fall back on once no version matched
  definition: PluginDefinition | undefined
}

export interface PluginUpdate {
  // the newest compatible published version, strictly newer than installed
  pluginVersion: string
  // the store's name (the UMD global, e.g. "GWAS") — the definition must be
  // installed under this, not the runtime Plugin class name (e.g. "GWASPlugin")
  name: string
  // the version-pinned definition to install in place of the current one
  definition: PluginDefinition
}

// `*` (and empty) mean "any JBrowse version"; compare-versions throws on those,
// so handle them directly. A malformed range simply fails to match rather than
// breaking the store UI — producer-side validation is the place to reject those.
function rangeMatches(jbrowseVersion: string, range: string) {
  let matched = range === '*' || range === ''
  if (!matched) {
    try {
      matched = satisfies(jbrowseVersion, range)
    } catch {
      matched = false
    }
  }
  return matched
}

// undefined rather than a throw: an entry that lists urls only per version has
// none to offer once no version matched, and throwing there took out the whole
// plugin-store list instead of rendering that one card as incompatible.
function definitionFrom(
  name: string,
  src: UrlFields,
): PluginDefinition | undefined {
  const integrity = src.integrity ? { integrity: src.integrity } : {}
  return src.umdUrl !== undefined
    ? { name, umdUrl: src.umdUrl, ...integrity }
    : src.esmUrl !== undefined
      ? { esmUrl: src.esmUrl }
      : src.cjsUrl !== undefined
        ? { cjsUrl: src.cjsUrl }
        : src.url !== undefined
          ? { name, url: src.url, ...integrity }
          : undefined
}

function highestVersion(versions: JBrowsePluginVersion[]) {
  return [...versions].sort((a, b) =>
    compareVersions(b.pluginVersion, a.pluginVersion),
  )[0]
}

// compareVersions throws on non-semver input; an unparsable installed version
// simply means "can't tell", so treat it as no-update-available rather than
// breaking the installed-plugins list.
function isNewer(candidate: string, installed: string) {
  let newer: boolean
  try {
    newer = compareVersions(candidate, installed) > 0
  } catch {
    newer = false
  }
  return newer
}

// Picks the newest plugin version whose declared JBrowse range covers the
// running JBrowse version. Plugins with no versions[] use their top-level url
// for all JBrowse versions.
export function resolvePlugin(
  plugin: JBrowsePlugin,
  jbrowseVersion: string,
): ResolvedPlugin {
  const versions = plugin.versions ?? []
  const supportedRanges = versions.map(v => v.jbrowseRange)
  const matching = versions.filter(v =>
    rangeMatches(jbrowseVersion, v.jbrowseRange),
  )
  const best = matching.length > 0 ? highestVersion(matching) : undefined

  // no declared versions → the top-level url covers every JBrowse version; with
  // versions declared, compatible only if one of their ranges matched.
  const compatible = versions.length === 0 || best !== undefined
  // install the matched version's pinned build; when nothing matched (or nothing
  // was declared) fall back to the plugin's top-level definition.
  const source = best ?? plugin
  return {
    compatible,
    pluginVersion: best?.pluginVersion,
    supportedRanges,
    definition: definitionFrom(plugin.name, source),
  }
}

// The store mints version-pinned install urls as
// `<base>/<packageName>/<version>/<umdPath>`, so the installed version is the
// path segment immediately after the package name. This is authoritative (the
// store put it there at install time) unlike a plugin's self-declared version.
// Returns undefined for custom or pre-versioning urls that don't follow this
// layout, which correctly surfaces as "no update available".
export function installedVersionFromUrl(
  url: string | undefined,
  packageName: string | undefined,
) {
  let version: string | undefined
  if (url !== undefined && packageName !== undefined) {
    const marker = `/${packageName}/`
    const start = url.indexOf(marker)
    if (start !== -1) {
      const [segment] = url.slice(start + marker.length).split('/')
      version = segment ? segment : undefined
    }
  }
  return version
}

/**
 * Whether a store entry is already among `installed`.
 *
 * Matched by packageName rather than by the resolved url wherever the store
 * publishes one: once a newer compatible version appears the resolved url
 * changes, and a url match would report "not installed" and let the user add a
 * second copy of the same plugin (same UMD global name) alongside the one
 * already there, which then fails to load with duplicate pluggable-element
 * registrations. Moving to a newer version is a separate, explicit action.
 */
export function isPluginInstalled(
  plugin: JBrowsePlugin,
  resolved: ResolvedPlugin,
  installed: PluginDefinition[],
) {
  const { packageName } = plugin
  const { definition } = resolved
  return installed.some(d =>
    packageName === undefined
      ? definition !== undefined && samePlugin(d, definition)
      : installedVersionFromUrl(maybePluginUrl(d), packageName) !== undefined,
  )
}

// Given the store entry for an already-installed plugin and the version it is
// currently running, returns the newest compatible published version when one
// exists that is strictly newer than installed, else undefined. Installs pin a
// version-immutable url, so an installed plugin never auto-updates; this is what
// surfaces a manual "update available" affordance. Entries without a resolvable
// pluginVersion (no versions[]) yield undefined since their version is unknown.
export function getPluginUpdate(
  plugin: JBrowsePlugin,
  jbrowseVersion: string,
  installedVersion: string | undefined,
): PluginUpdate | undefined {
  const resolved = resolvePlugin(plugin, jbrowseVersion)
  const { definition } = resolved
  return resolved.compatible &&
    definition !== undefined &&
    resolved.pluginVersion !== undefined &&
    installedVersion !== undefined &&
    isNewer(resolved.pluginVersion, installedVersion)
    ? { pluginVersion: resolved.pluginVersion, name: plugin.name, definition }
    : undefined
}

/**
 * A definition whose store ref could not be turned into something loadable,
 * with the reason.
 *
 * Structurally identical to `PluginLoader`'s `PluginLoadFailure`, and
 * deliberately re-declared rather than imported: that module pulls in ReExports
 * — effectively all of core — which is the whole reason inspecting a definition
 * lives apart from running one. Matching the shape lets a product report a
 * plugin that could not be resolved and one that could not be loaded through a
 * single path, which is what its user sees anyway.
 */
export interface StorePluginFailure {
  definition: PluginDefinition
  error: unknown
}

export interface StorePluginResolution {
  definitions: PluginDefinition[]
  failures: StorePluginFailure[]
}

/**
 * Replaces every store ref in `defs` with the concrete definition the store
 * publishes for this JBrowse version, and passes everything else through
 * untouched.
 *
 * A ref names the store's `name`, not the npm package — the store owns the
 * former and can repoint it at a different package without breaking a config
 * that named it years ago (jbrowse-plugin-list ADR 0008). `packageName` stays
 * the key on the install side, where pinning is the point.
 *
 * `storePlugins` is `undefined` when the manifest could not be read at all.
 * That is a different situation from a name the manifest does not list, but it
 * gets the same answer, and the split that matters is elsewhere:
 *
 * - **No answer from the store** — unreachable, or the name is not listed
 *   (retired, renamed, never published). A ref that also carries a url falls
 *   back to it: that url is what a JBrowse without ref support loads from the
 *   same config today, so falling back is exactly no worse than not having
 *   tried. A ref with no url has nothing to fall back on and fails.
 * - **An answer of "not for this JBrowse"** — the package is listed and no
 *   published version's `jbrowseRange` covers the running version. This does
 *   NOT fall back. The store has an opinion and the opinion is that the bundle
 *   does not work here; loading the url anyway is the hole ADR 0007 describes,
 *   where narrowing a range hid a broken plugin from careful clients and left
 *   it armed for everyone else.
 *
 * The resolved definition keeps `storePlugin`. It is the only one of the three
 * identity keys that survives resolution, so it is what lets `samePlugin` match
 * a config's resolved entry against a session's still-unresolved ref for the
 * same plugin. It ends up equal to the definition's `name`, because the store's
 * `name` is what both are.
 */
export function resolveStoreRefs(
  defs: PluginDefinition[],
  storePlugins: JBrowsePlugin[] | undefined,
  jbrowseVersion: string,
): StorePluginResolution {
  const definitions: PluginDefinition[] = []
  const failures: StorePluginFailure[] = []
  for (const definition of defs) {
    const ref = storePluginName(definition)
    if (ref === undefined) {
      definitions.push(definition)
      continue
    }
    const entry = storePlugins?.find(p => p.name === ref)
    if (entry === undefined) {
      const fallback = maybePluginUrl(definition)
      if (fallback === undefined) {
        failures.push({
          definition,
          error: new Error(
            storePlugins === undefined
              ? `Could not read the plugin store, so "${ref}" could not be resolved, and it names no url to fall back on.`
              : `"${ref}" is not in the plugin store, and it names no url to fall back on.`,
          ),
        })
      } else {
        console.warn(
          `Loading "${ref}" from ${fallback} — ${
            storePlugins === undefined
              ? 'the plugin store could not be read'
              : 'it is not in the plugin store'
          }.`,
        )
        definitions.push(definition)
      }
      continue
    }
    const resolved = resolvePlugin(entry, jbrowseVersion)
    if (!resolved.compatible || resolved.definition === undefined) {
      failures.push({
        definition,
        error: new Error(
          `The plugin store publishes no build of "${ref}" for JBrowse ${jbrowseVersion}${
            resolved.supportedRanges.length > 0
              ? ` (it supports ${resolved.supportedRanges.join(' or ')}).`
              : '.'
          }`,
        ),
      })
      continue
    }
    definitions.push({ ...resolved.definition, storePlugin: ref })
  }
  return { definitions, failures }
}

/**
 * `resolveStoreRefs` with the manifest fetched for it — the form a product
 * calls, immediately before it drops vendored plugins and loads what is left.
 *
 * Fetches nothing when no definition is a ref, which is every config that
 * predates them and every session a user assembled by hand. The store is on the
 * boot path only for the configs that opted in.
 */
export async function resolveStorePluginRefs(
  defs: PluginDefinition[],
  jbrowseVersion: string,
  fetchStore: () => Promise<{ plugins: JBrowsePlugin[] }> = fetchPlugins,
): Promise<StorePluginResolution> {
  if (!defs.some(isStorePluginDefinition)) {
    return { definitions: defs, failures: [] }
  }
  let storePlugins: JBrowsePlugin[] | undefined
  try {
    storePlugins = (await fetchStore()).plugins
  } catch (error) {
    console.error(error)
  }
  return resolveStoreRefs(defs, storePlugins, jbrowseVersion)
}
