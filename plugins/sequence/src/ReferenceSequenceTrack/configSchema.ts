/* eslint-disable @typescript-eslint/no-explicit-any */
import clone from 'clone'
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

      /**
       * #slot
       */
      name: {
        type: 'string',
        description:
          'optional track name, otherwise uses the "Reference sequence (assemblyName)"',
        defaultValue: '',
      },

      /**
       * #slot
       */
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      },

      formatAbout: ConfigurationSchema('FormatAbout', {
        /**
         * #slot formatAbout.config
         */
        config: {
          type: 'frozen',
          description: 'formats configuration in about dialog',
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
        const snap = clone(s) as any
        const { displays = [] } = snap as {
          trackId: string
          displays:
            | { displayId?: string; type: string }[]
            | Record<string, { displayId?: string; [key: string]: unknown }>
        }
        let displaysToUse = displays as any[]
        if (snap.trackId !== 'placeholderId') {
          let displayTypesInConf: Set<string>
          if (Array.isArray(displays)) {
            // Gets the displays on the track snapshot and the possible displays
            // from the track type and adds any missing possible displays to the
            // snapshot
            displayTypesInConf = new Set(
              displays.filter(d => !!d).map(d => d.type),
            )
            displaysToUse = displays
          } else {
            displayTypesInConf = new Set(Object.keys(displays))
            displaysToUse = Object.entries(displays).map(([key, val]) => ({
              type: key,
              displayId: val.displayId || snap.trackId + '-' + key,
              ...(val as Record<string, unknown>),
            }))
          }

          const trackType = pluginManager.getTrackType(snap.type)
          trackType.displayTypes.forEach(d => {
            if (!displayTypesInConf.has(d.name)) {
              displaysToUse.push({
                displayId: `${snap.trackId}-${d.name}`,
                type: d.name,
              })
            }
          })
        }
        return { ...snap, displays: displaysToUse }
      },
      /**
       * #identifier
       * all tracks have a globally unique 'trackId'
       */
      explicitIdentifier: 'trackId',
      explicitlyTyped: true,
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
    },
  )
}
