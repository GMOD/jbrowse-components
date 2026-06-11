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
        description: 'descriptive name of the track',
        type: 'string',
        defaultValue: 'Track',
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
      },
      /**
       * #slot
       */
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),

      textSearching: ConfigurationSchema('textSearching', {
        /**
         * #slot textSearching.indexedAttributes
         */
        indexingAttributes: {
          type: 'stringArray',
          description:
            'list of which feature attributes to index for text searching',
          defaultValue: ['Name', 'ID'],
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
       * The track's displays. You can give this two ways:
       *
       * - an **object** of appearance settings, e.g. `displays: { color: 'green' }`.
       *   JBrowse applies each setting to the display that uses it, so you don't
       *   need to know the display's name or write the array. If a track can be
       *   shown more than one way, each setting lands where it fits (for example
       *   `color` on a variant track's linear view, `strokeColor` on its circular
       *   view). A setting that nothing on the track uses is ignored, with a
       *   console warning so typos show up.
       * - an **array** of full display configs, e.g.
       *   `displays: [{ type: 'LinearBasicDisplay', color: 'green' }]`, when you
       *   need exact control — your own `displayId`, different settings for two
       *   displays, or choosing which display is the default.
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
      preProcessSnapshot: s2 => {
        const snap = expandTrackConfigShorthand(
          pluginManager.evaluateExtensionPoint(
            'Core-preProcessTrackConfig',
            structuredClone(s2),
          ),
          pluginManager,
        ) as TrackConfigSnapshot
        const { displays = [] } = snap
        if (snap.trackId !== 'placeholderId') {
          // Gets the displays on the track snapshot and the possible displays
          // from the track type and adds any missing possible displays to the
          // snapshot
          try {
            const configDisplayTypes = new Set(displays.map(d => d.type))
            for (const d of pluginManager.getTrackType(snap.type)
              .displayTypes) {
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
              {
                cause: e,
              },
            )
          }
        }
        const displayElements = pluginManager.getDisplayElements()
        const knownDisplayTypes = new Set(displayElements.map(d => d.name))
        // Map of legacy display type → canonical name, built from each
        // DisplayType's `aliases` declaration. Lets each display "own" its
        // renames without a central migration file.
        const displayAliasMap = new Map<string, string>()
        for (const d of displayElements) {
          if (d.aliases) {
            for (const alias of d.aliases) {
              displayAliasMap.set(alias, d.name)
            }
          }
        }
        const knownRendererTypes = new Set(
          pluginManager.getRendererTypes().map(r => r.name),
        )
        // Old sessions can carry several display configs whose types are all
        // aliases of one canonical type (e.g. v4.3.0 alignments had separate
        // LinearPileupDisplay/LinearSNPCoverageDisplay/... that now collapse to
        // LinearAlignmentsDisplay). After alias normalization, dedupe by type so
        // the track config holds one display per type — otherwise the Display
        // types menu shows duplicate radio entries. First occurrence wins to
        // preserve the default (displays[0]).
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
            .map(d =>
              liftLegacyRendererConfig(d, snap.trackId, knownRendererTypes),
            ),
        }
      },
      /**
       * #identifier
       */
      explicitIdentifier: 'trackId',
      explicitlyTyped: true,

      actions: (self: any) => ({
        addDisplayConf(conf: { type: string; displayId: string }) {
          const { type } = conf
          if (!type) {
            throw new Error('display type not specified')
          }
          const display = self.displays.find(
            (d: { displayId?: string }) => d.displayId === conf.displayId,
          )
          if (display) {
            return display
          }
          const length = self.displays.push(conf)
          return self.displays[length - 1]
        },
      }),
    },
  )
}

export type BaseTrackConfigSchema = ReturnType<typeof createBaseTrackConfig>
export type BaseTrackConfig = Instance<BaseTrackConfigSchema>
