import { types, Instance } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import PluginManager from '../../PluginManager'

/**
 * #config BaseTrack
 */
export function createBaseTrackConfig(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'BaseTrack',
    {
      /**
       * #slot
       */
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),

      /**
       * #slot
       */
      assemblyNames: {
        defaultValue: ['assemblyName'],
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
      },

      /**
       * #slot
       */
      category: {
        defaultValue: [],
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
      },

      /**
       * #slot
       */
      description: {
        defaultValue: '',
        description: 'a description of the track',
        type: 'string',
      },

      /**
       * #slot
       */
      displays: types.array(pluginManager.pluggableConfigSchemaType('display')),

      formatAbout: ConfigurationSchema('FormatAbout', {
        /**
         * #slot formatAbout.config
         */
        config: {
          contextVariable: ['config'],
          defaultValue: {},
          description: 'formats configuration object in about dialog',
          type: 'frozen',
        },

        /**
         * #slot formatAbout.hideUris
         */
        hideUris: {
          defaultValue: false,
          type: 'boolean',
        },
      }),

      formatDetails: ConfigurationSchema('FormatDetails', {
        /**
         * #slot formatDetails.depth
         */
        depth: {
          defaultValue: 2,
          description:
            'depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2',
          type: 'number',
        },

        /**
         * #slot formatDetails.feature
         */
        feature: {
          contextVariable: ['feature'],
          defaultValue: {},
          description: 'adds extra fields to the feature details',
          type: 'frozen',
        },

        /**
         * #slot formatDetails.maxDepth
         */
        maxDepth: {
          defaultValue: 99999,
          description: 'Maximum depth to render subfeatures',
          type: 'number',
        },

        /**
         * #slot formatDetails.subfeatures
         */
        subfeatures: {
          contextVariable: ['feature'],
          defaultValue: {},
          description: 'adds extra fields to the subfeatures of a feature',
          type: 'frozen',
        },
      }),

      /**
       * #slot
       */
      metadata: {
        defaultValue: {},
        description: 'anything to add about this track',
        type: 'frozen',
      },

      /**
       * #slot
       */
      name: {
        defaultValue: 'Track',
        description: 'descriptive name of the track',
        type: 'string',
      },
      textSearching: ConfigurationSchema('textSearching', {
        /**
         * #slot textSearching.indexedAttributes
         */
        indexingAttributes: {
          defaultValue: ['Name', 'ID'],
          description:
            'list of which feature attributes to index for text searching',
          type: 'stringArray',
        },
        /**
         * #slot textSearching.indexingFeatureTypesToExclude
         */
        indexingFeatureTypesToExclude: {
          defaultValue: ['CDS', 'exon'],
          description: 'list of feature types to exclude in text search index',
          type: 'stringArray',
        },

        /**
         * #slot textSearching.textSearchAdapter
         */
        textSearchAdapter: pluginManager.pluggableConfigSchemaType(
          'text search adapter',
        ),
      }),
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: (self: any) => ({
        addDisplayConf(conf: { type: string; displayId: string }) {
          const { type } = conf
          if (!type) {
            throw new Error(`unknown display type ${type}`)
          }
          const display = self.displays.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (d: any) => d?.displayId === conf.displayId,
          )
          if (display) {
            return display
          }
          const length = self.displays.push(conf)
          return self.displays[length - 1]
        },
      }),

      /**
       * #identifier
       */
      explicitIdentifier: 'trackId',

      explicitlyTyped: true,

      preProcessSnapshot: s2 => {
        const snap = pluginManager.evaluateExtensionPoint(
          'Core-preProcessTrackConfig',
          JSON.parse(JSON.stringify(s2)),
        ) as {
          trackId: string
          name: string
          type: string
          displays: { type: string; displayId: string }[]
        }
        const { displays = [] } = snap
        if (snap.trackId !== 'placeholderId') {
          // Gets the displays on the track snapshot and the possible displays
          // from the track type and adds any missing possible displays to the
          // snapshot
          const configDisplayTypes = new Set(
            displays.filter(d => !!d).map(d => d.type),
          )
          pluginManager.getTrackType(snap.type).displayTypes.forEach(d => {
            if (!configDisplayTypes.has(d.name)) {
              displays.push({
                displayId: `${snap.trackId}-${d.name}`,
                type: d.name,
              })
            }
          })
        }
        return { ...snap, displays }
      },
    },
  )
}

export type BaseTrackConfigSchema = ReturnType<typeof createBaseTrackConfig>
export type BaseTrackConfig = Instance<BaseTrackConfigSchema>
