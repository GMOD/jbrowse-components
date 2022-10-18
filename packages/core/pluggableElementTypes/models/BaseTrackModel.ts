import { transaction } from 'mobx'
import { getRoot, resolveIdentifier, types, Instance } from 'mobx-state-tree'
import {
  getConf,
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '../../configuration'
import PluginManager from '../../PluginManager'
import { MenuItem } from '../../ui'
import { getContainingView, getSession, getEnv } from '../../util'
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
      displays: types.array(
        pluginManager.pluggableMstType('display', 'stateModel'),
      ),
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
        const menuItems: MenuItem[] = []
        self.displays.forEach(display => {
          menuItems.push(...display.viewMenuActions)
        })
        return menuItems
      },
      get canConfigure() {
        const session = getSession(self)
        return (
          isSessionModelWithConfigEditing(session) &&
          // @ts-ignore
          (session.adminMode ||
            // @ts-ignore
            session.sessionTracks.find(track => {
              return track.trackId === self.configuration.trackId
            }))
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
      showDisplay(displayId: string, initialSnapshot = {}) {
        const schema = pluginManager.pluggableConfigSchemaType('display')
        const conf = resolveIdentifier(schema, getRoot(self), displayId)
        const displayType = pluginManager.getDisplayType(conf.type)
        if (!displayType) {
          throw new Error(`unknown display type ${conf.type}`)
        }
        const display = displayType.stateModel.create({
          ...initialSnapshot,
          type: conf.type,
          configuration: conf,
        })
        self.displays.push(display)
      },

      hideDisplay(displayId: string) {
        const schema = pluginManager.pluggableConfigSchemaType('display')
        const conf = resolveIdentifier(schema, getRoot(self), displayId)
        const t = self.displays.filter(d => d.configuration === conf)
        transaction(() => t.forEach(d => self.displays.remove(d)))
        return t.length
      },
      replaceDisplay(oldId: string, newId: string, initialSnapshot = {}) {
        const idx = self.displays.findIndex(
          d => d.configuration.displayId === oldId,
        )
        if (idx === -1) {
          throw new Error(`could not find display id ${oldId} to replace`)
        }
        const schema = pluginManager.pluggableConfigSchemaType('display')
        const conf = resolveIdentifier(schema, getRoot(self), newId)
        const displayType = pluginManager.getDisplayType(conf.type)
        if (!displayType) {
          throw new Error(`unknown display type ${conf.type}`)
        }
        self.displays.splice(idx, 1, {
          ...initialSnapshot,
          type: conf.type,
          configuration: conf,
        })
      },
    }))
    .views(self => ({
      trackMenuItems(): MenuItem[] {
        const menuItems: MenuItem[] = []
        self.displays.forEach(display => {
          menuItems.push(...display.trackMenuItems())
        })
        const displayChoices: MenuItem[] = []
        const view = getContainingView(self)
        const viewType = pluginManager.getViewType(view.type)
        const compatibleDisplayTypes = viewType.displayTypes.map(
          displayType => displayType.name,
        )
        const compatibleDisplays = self.configuration.displays.filter(
          (displayConf: AnyConfigurationModel) =>
            compatibleDisplayTypes.includes(displayConf.type),
        )
        const shownId = self.displays[0].configuration.displayId
        if (compatibleDisplays.length > 1) {
          displayChoices.push(
            { type: 'divider' },
            { type: 'subHeader', label: 'Display types' },
          )
          compatibleDisplays.forEach((displayConf: AnyConfigurationModel) => {
            displayChoices.push({
              type: 'radio',
              label: displayConf.type,
              checked: displayConf.displayId === shownId,
              onClick: () =>
                self.replaceDisplay(shownId, displayConf.displayId),
            })
          })
        }
        return [...menuItems, ...displayChoices]
      },
    }))
}

export type BaseTrackStateModel = ReturnType<typeof createBaseTrackModel>
export type BaseTrackModel = Instance<BaseTrackStateModel>
