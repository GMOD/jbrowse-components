import PluginLoader from '@jbrowse/core/PluginLoader'
import { dropVendoredPlugins } from '@jbrowse/core/pluginDefinitions'
import { resolveStorePluginRefs } from '@jbrowse/core/util'

import type { LoadedPlugin } from '@jbrowse/core/PluginLoader'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

export interface LoadPluginsArgs {
  fetchESM?: (url: string) => Promise<LoadedPlugin>
  /**
   * Resolve relative plugin urls against this instead of the page. A config
   * fetched from somewhere else names its plugins relative to itself, so pass
   * that config's url — otherwise a `"url": "umd_plugin.js"` entry is looked
   * for next to your own app and 404s.
   */
  baseUri?: string
  /** @deprecated the pre-4.4 spelling of `baseUri` */
  baseUrl?: string
}

/**
 * The body of every embedded product's `loadPlugins`. Each product keeps its own
 * one-line wrapper, because the doc comment on it is the published API surface
 * and names that product's own entry points — but the behavior is here, so the
 * two things that differed between the copies can't drift again: react-app's
 * accepted no `baseUrl`, and only two of the three defaulted the base url at
 * all.
 *
 * `dropVendored` is the one difference that is real, so it is a required
 * argument rather than a default. A product that bundles the vendored plugins
 * (see `vendoredPluginNames`) must drop a config's entry for them or it installs
 * a second copy beside its own; a product that does not bundle them — the
 * circular-genome-view build has neither MafViewer nor GWAS in its corePlugins —
 * must still fetch one a config names, or the config silently loses the plugin.
 */
export async function loadRuntimePlugins(
  pluginDefinitions: PluginDefinition[],
  {
    dropVendored,
    jbrowseVersion,
    ...args
  }: LoadPluginsArgs & { dropVendored: boolean; jbrowseVersion: string },
) {
  // Before dropVendoredPlugins, which matches on the UMD name a ref does not
  // carry until the store supplies it. `jbrowseVersion` is required rather than
  // defaulted so a product that forgets it fails to compile instead of quietly
  // resolving every range against the wrong host.
  const { definitions, failures } = await resolveStorePluginRefs(
    pluginDefinitions,
    jbrowseVersion,
  )
  // This path ends in `load`, which is all-or-nothing (see below) — so a ref
  // that resolved to nothing is a failure now rather than a plugin the embedder
  // silently never receives.
  if (failures[0]) {
    throw failures[0].error
  }
  const toLoad = dropVendored ? dropVendoredPlugins(definitions) : definitions
  // the default matters: `new URL('umd_plugin.js', undefined)` throws, so a
  // relative plugin url used to fail outright instead of resolving against the
  // page the way every other relative url does
  const base = args.baseUri ?? args.baseUrl
  return toLoad.length
    ? new PluginLoader(toLoad, args)
        .installGlobalReExports(window)
        .load(base ?? window.location.href)
    : []
}
