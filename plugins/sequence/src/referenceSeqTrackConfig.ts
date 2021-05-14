/* eslint-disable @typescript-eslint/no-explicit-any */
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

/*
Note: this is primarily a copy of createBaseTrackConfig, except with a subset
of the config slots, to avoid including fields that don't make sense for the
ReferenceSequenceTrack
*/
export function createReferenceSeqTrackConfig(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'ReferenceSequenceTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      displays: types.array(pluginManager.pluggableConfigSchemaType('display')),
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      },
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
