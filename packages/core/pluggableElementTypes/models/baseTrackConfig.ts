/* eslint-disable @typescript-eslint/no-explicit-any */
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
      preProcessSnapshot: s => {
        const snap = JSON.parse(JSON.stringify(s))
        const displayTypes = new Set()
        const { displays = [] } = snap
        if (snap.trackId !== 'placeholderId') {
          // Gets the displays on the track snapshot and the possible displays
          // from the track type and adds any missing possible displays to the
          // snapshot
          displays.forEach((d: any) => d && displayTypes.add(d.type))
          const trackType = pluginManager.getTrackType(snap.type)
          trackType.displayTypes.forEach(displayType => {
            if (!displayTypes.has(displayType.name)) {
              displays.push({
                displayId: `${snap.trackId}-${displayType.name}`,
                type: displayType.name,
              })
            }
          })
        }
        return { ...snap, displays }
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
            throw new Error(`unknown display type ${type}`)
          }
          const display = self.displays.find(
            (d: any) => d?.displayId === conf.displayId,
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

export type BaseTrackConfigModel = ReturnType<typeof createBaseTrackConfig>
export type BaseTrackConfig = Instance<BaseTrackConfigModel>
