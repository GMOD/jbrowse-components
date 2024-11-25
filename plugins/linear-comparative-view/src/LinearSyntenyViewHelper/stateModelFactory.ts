import { ElementId } from '@jbrowse/core/util/types/mst'
import { transaction } from 'mobx'
import { getRoot, resolveIdentifier, types, getParent } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

export function linearSyntenyViewHelperModelFactory(
  pluginManager: PluginManager,
) {
  return types
    .model('LinearSyntenyViewHelper', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
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
    .views(self => ({
      get assemblyNames() {
        const p = getParent<{ views: LinearGenomeViewModel[] }>(self, 2)
        return [
          p.views[self.level]!.assemblyNames[0],
          p.views[self.level + 1]!.assemblyNames[0],
        ]
      },
    }))
}

export type LinearSyntenyViewHelperStateModel = ReturnType<
  typeof linearSyntenyViewHelperModelFactory
>
export type LinearSyntenyViewHelperModel =
  Instance<LinearSyntenyViewHelperStateModel>
