/* eslint-disable @typescript-eslint/no-explicit-any */
import InfoIcon from '@material-ui/icons/Info'
import { transaction } from 'mobx'
import { getRoot, Instance, resolveIdentifier, types } from 'mobx-state-tree'
import { getConf } from '../../configuration'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '../../configuration/configurationSchema'
import PluginManager from '../../PluginManager'
import { MenuItem } from '../../ui'
import { getContainingView, getSession } from '../../util'
import { getParentRenderProps } from '../../util/tracks'
import { isSessionModelWithConfigEditing } from '../../util/types'
import { ElementId } from '../../util/types/mst'

// these MST models only exist for tracks that are *shown*.
// they should contain only UI state for the track, and have
// a reference to a track configuration (stored under
// session.configuration.assemblies.get(assemblyName).tracks).

// note that multiple displayed tracks could use the same configuration.
export function createBaseTrackModel(
  pluginManager: PluginManager,
  baseTrackConfig: AnyConfigurationSchemaType,
) {
  return types
    .model('BaseTrack', {
      id: ElementId,
      type: types.string,
      configuration: ConfigurationReference(baseTrackConfig),
      displays: types.array(
        pluginManager.pluggableMstType('display', 'stateModel'),
      ),
    })
    .volatile(() => ({
      showAbout: false,
    }))
    .actions(self => ({
      setShowAbout(show: boolean) {
        self.showAbout = show
      },
    }))
    .views(self => ({
      get rpcSessionId() {
        return self.id
      },

      get name() {
        return getConf(self, 'name')
      },

      /**
       * the react props that are passed to the Renderer when data
       * is rendered in this track
       */
      get renderProps() {
        return {
          ...getParentRenderProps(self),
          trackModel: self,
        }
      },

      /**
       * the PluggableElementType for the currently defined adapter
       */
      get adapterType() {
        const adapterConfig = getConf(self, 'adapter')
        const session = getSession(self)
        if (!adapterConfig)
          throw new Error(`no adapter configuration provided for ${self.type}`)
        const adapterType = session.pluginManager.getAdapterType(
          adapterConfig.type,
        )
        if (!adapterType)
          throw new Error(`unknown adapter type ${adapterConfig.type}`)
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
      get trackMenuItems(): MenuItem[] {
        const menuItems: MenuItem[] = []
        self.displays.forEach(display => {
          menuItems.push(...display.trackMenuItems)
        })
        return [
          {
            label: 'About this track',
            icon: InfoIcon,
            priority: 10,
            onClick: () => {
              self.setShowAbout(true)
            },
          },
          ...menuItems,
        ]
      },
      // distinct set of track items that are particular to this track type. for
      // base, there are none
      //
      // note: this attribute is helpful when composing together multiple
      // subtracks so that you don't repeat the "about this track" from each
      // child track
      get composedTrackMenuItems(): MenuItem[] {
        return []
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
        const displayTypeConfigSchema = pluginManager.pluggableConfigSchemaType(
          'display',
        )
        const configuration = resolveIdentifier(
          displayTypeConfigSchema,
          getRoot(self),
          displayId,
        )
        const displayType = pluginManager.getDisplayType(configuration.type)
        if (!displayType) {
          throw new Error(`unknown display type ${configuration.type}`)
        }
        const display = displayType.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        self.displays.push(display)
      },

      hideDisplay(displayId: string) {
        const displayTypeConfigSchema = pluginManager.pluggableConfigSchemaType(
          'display',
        )
        const configuration = resolveIdentifier(
          displayTypeConfigSchema,
          getRoot(self),
          displayId,
        )
        // if we have any displays with that configuration, turn them off
        const shownDisplays = self.displays.filter(
          d => d.configuration === configuration,
        )
        transaction(() => shownDisplays.forEach(d => self.displays.remove(d)))
        return shownDisplays.length
      },
    }))
}

export type BaseTrackStateModel = ReturnType<typeof createBaseTrackModel>
export type BaseTrackModel = Instance<BaseTrackStateModel>
