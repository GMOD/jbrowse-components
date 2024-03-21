/* eslint-disable @typescript-eslint/no-explicit-any */
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

// Note: this is primarily a copy of createBaseTrackConfig, except with a
// subset of the config slots, to avoid including fields that don't make sense
// for the ReferenceSequenceTrack

/**
 * #config ReferenceSequenceTrack
 * used to display base level DNA sequence tracks
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export function createReferenceSeqTrackConfig(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'ReferenceSequenceTrack',
    {
      /**
       * #slot
       * configuration for track adapter
       */
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),

      /**
       * #slot
       * configuration for the displays e.g. LinearReferenceSequenceDisplay
       */
      displays: types.array(pluginManager.pluggableConfigSchemaType('display')),

      formatAbout: ConfigurationSchema('FormatAbout', {
        /**
         * #slot formatAbout.config
         */
        config: {
          contextVariable: ['config'],
          defaultValue: {},
          description: 'formats configuration in about dialog',
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
        defaultValue: '',
        description:
          'optional track name, otherwise uses the "Reference sequence (assemblyName)"',
        type: 'string',
      },
    },
    {
      actions: (self: any) => ({
        addDisplayConf(displayConf: { type: string; displayId: string }) {
          const { type } = displayConf
          if (!type) {
            throw new Error(`unknown display type ${type}`)
          }
          const display = self.displays.find(
            (d: any) => d && d.displayId === displayConf.displayId,
          )
          if (display) {
            return display
          }
          const length = self.displays.push(displayConf)
          return self.displays[length - 1]
        },
      }),

      /**
       * #identifier
       * all tracks have a globally unique 'trackId'
       */
      explicitIdentifier: 'trackId',
      explicitlyTyped: true,
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
    },
  )
}
