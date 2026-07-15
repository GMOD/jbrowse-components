import { types } from '@jbrowse/mobx-state-tree'

import { expandTrackConfigShorthand } from './expandTrackConfigShorthand.ts'
import { liftLegacyRendererConfig } from './migrateTrackConfig.ts'
import { ConfigurationSchema } from '../../configuration/index.ts'

import type { LegacyDisplaySnapshot } from './migrateTrackConfig.ts'
import type PluginManager from '../../PluginManager.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

interface TrackConfigSnapshot {
  trackId: string
  name: string
  type: string
  displays?: LegacyDisplaySnapshot[]
}

/**
 * Snapshot normalization shared by every track config schema (including
 * ReferenceSequenceTrack). Runs the `Core-preProcessTrackConfig` extension
 * point, expands the `displayDefaults` shorthand, auto-fills a stub display for
 * each of the track type's registered displays, normalizes legacy display-type
 * aliases to their canonical name, dedupes by type (first wins), and lifts
 * legacy renderer configs.
 */
export function preprocessTrackConfigSnapshot(
  pluginManager: PluginManager,
  snapshot: Record<string, unknown>,
) {
  const snap = expandTrackConfigShorthand(
    pluginManager.evaluateExtensionPoint(
      /** #extensionPoint Core-preProcessTrackConfig | sync | Rewrite a track config snapshot before it is instantiated */
      'Core-preProcessTrackConfig',
      structuredClone(snapshot),
    ),
    pluginManager,
  ) as TrackConfigSnapshot
  // expandTrackConfigShorthand folds any `displayDefaults` shorthand into
  // `displays`, but its early-return branches can leave a malformed `displays`
  // untouched; guard so MST union-type probing never crashes on a non-array
  // `displays`.
  const displays = Array.isArray(snap.displays) ? snap.displays : []
  if (snap.trackId !== 'placeholderId') {
    // Add any of the track type's possible displays not already on the snapshot
    try {
      const configDisplayTypes = new Set(displays.map(d => d.type))
      for (const d of pluginManager.getTrackType(snap.type).displayTypes) {
        if (!configDisplayTypes.has(d.name)) {
          displays.push({
            displayId: `${snap.trackId}-${d.name}`,
            type: d.name,
          })
        }
      }
    } catch (e) {
      throw new Error(
        `Unknown track type "${snap.type}" in ${JSON.stringify(snap)}`,
        { cause: e },
      )
    }
  }
  const displayElements = pluginManager.getDisplayElements()
  const knownDisplayTypes = new Set(displayElements.map(d => d.name))
  // Map of legacy display type → canonical name, built from each DisplayType's
  // `aliases` declaration. Lets each display "own" its renames without a central
  // migration file.
  const displayAliasMap = new Map<string, string>()
  for (const d of displayElements) {
    if (d.aliases) {
      for (const alias of d.aliases) {
        displayAliasMap.set(alias, d.name)
      }
    }
  }
  // After alias normalization, dedupe by type so the track config holds one
  // display per type (old sessions can carry several display configs whose types
  // are all aliases of one canonical type). First occurrence wins to preserve
  // the default (displays[0]).
  const seenTypes = new Set<string>()
  return {
    ...snap,
    displays: displays
      .map(d => {
        const canonical = displayAliasMap.get(d.type)
        return canonical ? { ...d, type: canonical } : d
      })
      .filter(d => knownDisplayTypes.has(d.type))
      .filter(d => {
        const dup = seenTypes.has(d.type)
        seenTypes.add(d.type)
        return !dup
      })
      .map(d => liftLegacyRendererConfig(d, snap.trackId)),
  }
}

/**
 * The `addDisplayConf` action shared by every track config schema — appends a
 * display config unless one with the same displayId already exists.
 */
interface DisplayConf {
  type: string
  displayId: string
}

// The config-schema action boundary types `self` as `unknown` (option signature
// is `(self: unknown) => any`), so it can't be given a precise parameter type.
// Narrow it once to the minimal shape the action touches, keeping the body
// checked.
interface TrackConfigWithDisplays {
  displays: {
    find(cb: (d: DisplayConf) => boolean): DisplayConf | undefined
    push(conf: DisplayConf): number
    [index: number]: DisplayConf
  }
}

export function trackConfigActions(self: unknown) {
  const { displays } = self as TrackConfigWithDisplays
  return {
    addDisplayConf(conf: DisplayConf) {
      const { type } = conf
      if (!type) {
        throw new Error('display type not specified')
      }
      const display = displays.find(d => d.displayId === conf.displayId)
      if (display) {
        return display
      }
      const length = displays.push(conf)
      return displays[length - 1]
    },
  }
}

/**
 * #config BaseTrack
 * Configuration shared by all track types. Concrete tracks (FeatureTrack,
 * AlignmentsTrack, VariantTrack, ...) extend this, so every track accepts these
 * fields in addition to its own.
 */
export function createBaseTrackConfig(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'BaseTrack',
    {
      /**
       * #slot
       */
      name: {
        description:
          'descriptive name of the track, falls back to the trackId when unset',
        type: 'string',
        defaultValue: '',
      },
      /**
       * #slot
       */
      assemblyNames: {
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
        defaultValue: ['assemblyName'],
      },
      /**
       * #slot
       */
      description: {
        description: 'a description of the track',
        type: 'string',
        defaultValue: '',
      },
      /**
       * #slot
       */
      category: {
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
        defaultValue: [],
      },
      /**
       * #slot
       */
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      },
      /**
       * #slot
       */
      rpcDriverName: {
        type: 'string',
        description:
          'RPC driver to use for this track. Leave empty to use the display-level or global default.',
        defaultValue: '',
        advanced: true,
      },
      /**
       * #slot
       */
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),

      textSearching: ConfigurationSchema('textSearching', {
        /**
         * #slot textSearching.indexingAttributes
         */
        indexingAttributes: {
          type: 'stringArray',
          description:
            'list of which feature attributes to index for text searching',
          defaultValue: ['Name', 'ID', 'symbol'],
        },
        /**
         * #slot textSearching.indexingFeatureTypesToExclude
         */
        indexingFeatureTypesToExclude: {
          type: 'stringArray',
          description: 'list of feature types to exclude in text search index',
          defaultValue: ['CDS', 'exon'],
        },

        /**
         * #slot textSearching.textSearchAdapter
         */
        textSearchAdapter: pluginManager.pluggableConfigSchemaType(
          'text search adapter',
        ),
      }),

      /**
       * #slot
       * An **array** of full display configs, e.g.
       * `displays: [{ type: 'LinearBasicDisplay', color: 'green' }]`. Each entry
       * names a display `type`; use this when you need exact control — your own
       * `displayId`, different settings for two displays, or choosing which
       * display is the default.
       *
       * For the common case, prefer the `displayDefaults` shorthand instead — an
       * object of appearance settings (e.g. `displayDefaults: { color: 'green' }`)
       * that JBrowse routes to whichever display uses each setting, so you don't
       * have to name the display or write the array.
       *
       * See the [track config guide](/docs/config_guides/tracks/#configuring-displays).
       */
      displays: types.array(pluginManager.pluggableConfigSchemaType('display')),

      formatDetails: ConfigurationSchema('FormatDetails', {
        /**
         * #slot formatDetails.feature
         */
        feature: {
          type: 'frozen',
          description: 'adds extra fields to the feature details',
          defaultValue: {},
          contextVariable: ['feature'],
        },
        /**
         * #slot formatDetails.subfeatures
         */
        subfeatures: {
          type: 'frozen',
          description: 'adds extra fields to the subfeatures of a feature',
          defaultValue: {},
          contextVariable: ['feature'],
        },
        /**
         * #slot formatDetails.depth
         */
        depth: {
          type: 'number',
          defaultValue: 2,
          description:
            'depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2',
        },
        /**
         * #slot formatDetails.maxDepth
         */
        maxDepth: {
          type: 'number',
          defaultValue: 99999,
          description: 'Maximum depth to render subfeatures',
        },
      }),
      formatAbout: ConfigurationSchema('FormatAbout', {
        /**
         * #slot formatAbout.config
         */
        config: {
          type: 'frozen',
          description: 'formats configuration object in about dialog',
          defaultValue: {},
          contextVariable: ['config'],
        },

        /**
         * #slot formatAbout.hideUris
         */
        hideUris: {
          type: 'boolean',
          defaultValue: false,
        },
      }),
    },
    {
      preProcessSnapshot: s2 =>
        preprocessTrackConfigSnapshot(pluginManager, s2),
      /**
       * #identifier
       */
      explicitIdentifier: 'trackId',
      explicitlyTyped: true,

      actions: trackConfigActions,
    },
  )
}

export type BaseTrackConfigSchema = ReturnType<typeof createBaseTrackConfig>
export type BaseTrackConfig = Instance<BaseTrackConfigSchema>
