import { compareVersions, satisfies } from 'compare-versions'

import type { PluginDefinition } from '../PluginLoader.ts'
import type { JBrowsePlugin, JBrowsePluginVersion } from './types/index.ts'

// The url-bearing fields shared by a JBrowsePlugin and a JBrowsePluginVersion.
type UrlFields = Pick<
  JBrowsePlugin,
  'url' | 'umdUrl' | 'esmUrl' | 'cjsUrl' | 'integrity'
>

export interface ResolvedPlugin {
  // false when the plugin declares versions but none support the running JBrowse
  compatible: boolean
  // the chosen published plugin version, when selected from versions[]
  pluginVersion?: string
  // every JBrowse range the plugin declares, for messaging when incompatible
  supportedRanges: string[]
  // the concrete, installable definition for the chosen url
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

function definitionFrom(name: string, src: UrlFields): PluginDefinition {
  const integrity = src.integrity ? { integrity: src.integrity } : {}
  const def =
    src.umdUrl !== undefined
      ? { name, umdUrl: src.umdUrl, ...integrity }
      : src.esmUrl !== undefined
        ? { esmUrl: src.esmUrl }
        : src.cjsUrl !== undefined
          ? { cjsUrl: src.cjsUrl }
          : src.url !== undefined
            ? { name, url: src.url, ...integrity }
            : undefined
  if (!def) {
    throw new Error(`plugin ${name} has no url`)
  }
  return def
}

function highestVersion(versions: JBrowsePluginVersion[]) {
  return [...versions].sort((a, b) =>
    compareVersions(b.pluginVersion, a.pluginVersion),
  )[0]
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

  return versions.length === 0
    ? {
        compatible: true,
        supportedRanges,
        definition: definitionFrom(plugin.name, plugin),
      }
    : best
      ? {
          compatible: true,
          pluginVersion: best.pluginVersion,
          supportedRanges,
          definition: definitionFrom(plugin.name, best),
        }
      : {
          compatible: false,
          supportedRanges,
          definition: definitionFrom(plugin.name, plugin),
        }
}
