import React from 'react'
import { getRoot, resolveIdentifier, types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { transaction } from 'mobx'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

export function linearSyntenyViewHelperModelFactory(
  pluginManager: PluginManager,
) {
  return types
    .model('LinearSyntenyViewHelper', {
      type: 'LinearSyntenyViewHelper',
      /**
       * #property
       */
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      /**
       * #property
       */
      height: 100,
      /**
       * #property
       */
      level: types.number,
    })
    .actions(self => ({
      /**
       * #action
       */
      setHeight(n: number) {
        self.height = n
        return self.height
      },

      /**
       * #action
       */
      showTrack(trackId: string, initialSnapshot = {}) {
        const schema = pluginManager.pluggableConfigSchemaType('track')
        const configuration = resolveIdentifier(schema, getRoot(self), trackId)
        if (!configuration) {
          throw new Error(`track not found ${trackId}`)
        }
        const trackType = pluginManager.getTrackType(configuration.type)
        if (!trackType) {
          throw new Error(`unknown track type ${configuration.type}`)
        }
        const viewType = pluginManager.getViewType(self.type)!
        const supportedDisplays = new Set(
          viewType.displayTypes.map(d => d.name),
        )
        const displayConf = configuration.displays.find(
          (d: AnyConfigurationModel) => supportedDisplays.has(d.type),
        )
        if (!displayConf) {
          throw new Error(
            `could not find a compatible display for view type ${self.type}`,
          )
        }

        self.tracks.push(
          trackType.stateModel.create({
            ...initialSnapshot,
            type: configuration.type,
            configuration,
            displays: [
              {
                type: displayConf.type,
                configuration: displayConf,
              },
            ],
          }),
        )
      },

      /**
       * #action
       */
      hideTrack(trackId: string) {
        const schema = pluginManager.pluggableConfigSchemaType('track')
        const config = resolveIdentifier(schema, getRoot(self), trackId)
        const shownTracks = self.tracks.filter(t => t.configuration === config)
        transaction(() => {
          shownTracks.forEach(t => {
            self.tracks.remove(t)
          })
        })
        return shownTracks.length
      },
      /**
       * #action
       */
      toggleTrack(trackId: string) {
        const hiddenCount = this.hideTrack(trackId)
        if (!hiddenCount) {
          this.showTrack(trackId)
          return true
        }
        return false
      },
    }))
}

function UnusedComponent() {
  return <div />
}

export default function LinearSyntenyViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearSyntenyViewHelper',
      displayName: 'Linear synteny view (helper)',
      stateModel: linearSyntenyViewHelperModelFactory(pluginManager),
      ReactComponent: UnusedComponent,
    })
  })
}
