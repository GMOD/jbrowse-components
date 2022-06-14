import {
  getEnv,
  getRoot,
  resolveIdentifier,
  types,
  Instance,
} from 'mobx-state-tree'
import {
  getConf,
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '../../configuration'
import PluginManager from '../../PluginManager'
import { MenuItem } from '../../ui'
import {
  getContainingView,
  getSession,
  getCompatibleDisplays,
} from '../../util'
import { isSessionModelWithConfigEditing } from '../../util/types'
import { ElementId } from '../../util/types/mst'

// these MST models only exist for tracks that are *shown*.
// they should contain only UI state for the track, and have
// a reference to a track configuration (stored under
// session.configuration.assemblies.get(assemblyName).tracks).

// note that multiple displayed tracks could use the same configuration.
export function createBaseTrackModel(
  pluginManager: PluginManager,
  trackType: string,
  baseTrackConfig: AnyConfigurationSchemaType,
) {
  return types
    .model(trackType, {
      id: ElementId,
      type: types.literal(trackType),
      configuration: ConfigurationReference(baseTrackConfig),
      display: pluginManager.pluggableMstType('display', 'stateModel'),
    })
    .views(self => ({
      get rpcSessionId() {
        return self.configuration.trackId
      },

      get name() {
        return getConf(self, 'name')
      },

      get textSearchAdapter() {
        return getConf(self, 'textSearchAdapter')
      },

      /**
       * the PluggableElementType for the currently defined adapter
       */
      get adapterType() {
        const adapterConfig = getConf(self, 'adapter')
        const { pluginManager: pm } = getEnv(self)
        if (!adapterConfig) {
          throw new Error(`no adapter configuration provided for ${self.type}`)
        }
        const adapterType = pm.getAdapterType(adapterConfig.type)
        if (!adapterType) {
          throw new Error(`unknown adapter type ${adapterConfig.type}`)
        }
        return adapterType
      },

      get viewMenuActions(): MenuItem[] {
        return self.display.viewMenuActions
      },
      get canConfigure() {
        const session = getSession(self)
        // @ts-ignore
        const isSessionTrack = session.sessionTracks.find(
          (t: { trackId: string }) => t.trackId === self.configuration.trackId,
        )
        return (
          isSessionModelWithConfigEditing(session) &&
          (session.adminMode || isSessionTrack)
        )
      },
    }))
    .actions(self => ({
      activateConfigurationUI() {
        const session = getSession(self)
        const view = getContainingView(self)
        if (isSessionModelWithConfigEditing(session)) {
          // @ts-ignore
          const trackConf = session.editTrackConfiguration(self.configuration)
          if (trackConf && trackConf !== self.configuration) {
            // @ts-ignore
            view.hideTrack(self.configuration)
            // @ts-ignore
            view.showTrack(trackConf)
          }
        }
      },

      showDisplay(newDisplayId: string, initialSnapshot = {}) {
        const schema = pluginManager.pluggableConfigSchemaType('display')
        const conf = resolveIdentifier(schema, getRoot(self), newDisplayId)
        const displayType = pluginManager.getDisplayType(conf.type)
        if (!displayType) {
          throw new Error(`unknown display type ${conf.type}`)
        }
        self.display = {
          ...initialSnapshot,
          type: conf.type,
          configuration: conf,
        }
      },
    }))
    .views(self => ({
      trackMenuItems(): MenuItem[] {
        const menuItems = self.display.trackMenuItems()

        const displayChoices: MenuItem[] = []
        const view = getContainingView(self)
        const compatibleDisplays = getCompatibleDisplays(
          self.configuration,
          view.type,
          pluginManager,
        )

        const shownId = self.display.configuration.displayId
        if (compatibleDisplays.length > 1) {
          displayChoices.push(
            { type: 'divider' },
            { type: 'subHeader', label: 'Display types' },
          )
          compatibleDisplays.forEach(str => {
            const displayConf = self.configuration.displays.get(str)
            displayChoices.push({
              type: 'radio',
              label: displayConf.type,
              checked: displayConf.displayId === shownId,
              onClick: () => self.showDisplay(displayConf.displayId),
            })
          })
        }
        return [...menuItems, ...displayChoices]
      },
    }))
    .preProcessSnapshot(snap => {
      // @ts-ignore
      if (Array.isArray(snap.displays)) {
        return {
          ...snap,
          // @ts-ignore
          display: snap.displays[0],
        }
      }
      return snap
    })
}

export type BaseTrackStateModel = ReturnType<typeof createBaseTrackModel>
export type BaseTrackModel = Instance<BaseTrackStateModel>
