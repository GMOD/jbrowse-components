import { transaction } from 'mobx'
import { getRoot, resolveIdentifier, types } from 'mobx-state-tree'

// locals
import { getConf, ConfigurationReference } from '../../configuration'
import { getContainingView, getEnv, getSession } from '../../util'
import { isSessionModelWithConfigEditing } from '../../util/types'
import { ElementId } from '../../util/types/mst'
import type PluginManager from '../../PluginManager'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '../../configuration'
import type { MenuItem } from '../../ui'
import type { Instance, IAnyStateTreeNode } from 'mobx-state-tree'

export function getCompatibleDisplays(self: IAnyStateTreeNode) {
  const { pluginManager } = getEnv(self)
  const view = getContainingView(self)
  const viewType = pluginManager.getViewType(view.type)!
  const compatTypes = new Set(viewType.displayTypes.map(d => d.name))
  const displays = self.configuration.displays as AnyConfigurationModel[]
  return displays.filter(d => compatTypes.has(d.type))
}

/**
 * #stateModel BaseTrackModel
 * #category track
 *
 * these MST models only exist for tracks that are *shown*. they should contain
 * only UI state for the track, and have a reference to a track configuration.
 * note that multiple displayed tracks could use the same configuration.
 */
export function createBaseTrackModel(
  pm: PluginManager,
  trackType: string,
  baseTrackConfig: AnyConfigurationSchemaType,
) {
  return types
    .model(trackType, {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal(trackType),
      /**
       * #property
       */
      configuration: ConfigurationReference(baseTrackConfig),
      /**
       * #property
       */
      minimized: false,
      /**
       * #property
       */
      displays: types.array(pm.pluggableMstType('display', 'stateModel')),
    })
    .views(self => ({
      /**
       * #getter
       * determines which webworker to send the track to, currently based on trackId
       */
      get rpcSessionId() {
        return self.configuration.trackId
      },
      /**
       * #getter
       */
      get name() {
        return getConf(self, 'name')
      },
      /**
       * #getter
       */
      get textSearchAdapter() {
        return getConf(self, 'textSearchAdapter')
      },

      /**
       * #getter
       */
      get adapterType() {
        const adapterConfig = getConf(self, 'adapter')
        if (!adapterConfig) {
          throw new Error(`no adapter configuration provided for ${self.type}`)
        }
        const adapterType = pm.getAdapterType(adapterConfig.type)
        if (!adapterType) {
          throw new Error(`unknown adapter type ${adapterConfig.type}`)
        }
        return adapterType
      },

      /**
       * #getter
       */
      get viewMenuActions(): MenuItem[] {
        return self.displays.flatMap(d => d.viewMenuActions)
      },

      /**
       * #getter
       */
      get canConfigure() {
        const session = getSession(self)
        const { sessionTracks, adminMode } = session
        return (
          isSessionModelWithConfigEditing(session) &&
          (adminMode ||
            sessionTracks?.find(t => t.trackId === self.configuration.trackId))
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setMinimized(flag: boolean) {
        self.minimized = flag
      },

      /**
       * #action
       */
      showDisplay(displayId: string, initialSnapshot = {}) {
        const schema = pm.pluggableConfigSchemaType('display')
        const conf = resolveIdentifier(schema, getRoot(self), displayId)
        const displayType = pm.getDisplayType(conf.type)
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

      /**
       * #action
       */
      hideDisplay(displayId: string) {
        const schema = pm.pluggableConfigSchemaType('display')
        const conf = resolveIdentifier(schema, getRoot(self), displayId)
        const t = self.displays.filter(d => d.configuration === conf)
        transaction(() => {
          t.forEach(d => self.displays.remove(d))
        })
        return t.length
      },

      /**
       * #action
       */
      replaceDisplay(oldId: string, newId: string, initialSnapshot = {}) {
        const idx = self.displays.findIndex(
          d => d.configuration.displayId === oldId,
        )
        if (idx === -1) {
          throw new Error(`could not find display id ${oldId} to replace`)
        }
        const schema = pm.pluggableConfigSchemaType('display')
        const conf = resolveIdentifier(schema, getRoot(self), newId)
        const displayType = pm.getDisplayType(conf.type)
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
      /**
       * #method
       */
      trackMenuItems() {
        const menuItems: MenuItem[] = self.displays.flatMap(d =>
          d.trackMenuItems(),
        )
        const shownId = self.displays[0].configuration.displayId
        const compatDisp = getCompatibleDisplays(self)

        return [
          ...menuItems,
          ...(compatDisp.length > 1
            ? [
                {
                  type: 'subMenu',
                  label: 'Display types',
                  priority: -1000,
                  subMenu: compatDisp.map(d => ({
                    type: 'radio',
                    label: pm.getDisplayType(d.type)!.displayName,
                    checked: d.displayId === shownId,
                    onClick: () => {
                      self.replaceDisplay(shownId, d.displayId)
                    },
                  })),
                },
              ]
            : []),
        ]
      },
    }))
}

export type BaseTrackStateModel = ReturnType<typeof createBaseTrackModel>
export type BaseTrackModel = Instance<BaseTrackStateModel>
