import { lazy } from 'react'

import { types } from '@jbrowse/mobx-state-tree'
import Save from '@mui/icons-material/Save'

import { ConfigurationReference, getConf } from '../../configuration'
import { adapterConfigCacheKey } from '../../data_adapters/util'
import { getContainingView, getEnv, getSession } from '../../util'
import { stringifyBED } from './saveTrackFileTypes/bed'
import { stringifyGBK } from './saveTrackFileTypes/genbank'
import { stringifyGFF3 } from './saveTrackFileTypes/gff3'
import { isSessionModelWithConfigEditing } from '../../util/types'
import { ElementId } from '../../util/types/mst'

import type PluginManager from '../../PluginManager'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '../../configuration'
import type { MenuItem } from '../../ui'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

const SaveTrackDataDlg = lazy(() => import('./components/SaveTrackData'))

interface DisplayConf {
  displayId: string
  type: string
}

export function getCompatibleDisplays(self: IAnyStateTreeNode) {
  const { pluginManager } = getEnv(self)
  const view = getContainingView(self)
  const viewType = pluginManager.getViewType(view.type)!
  const compatTypes = new Set(viewType.displayTypes.map(d => d.name))
  const displays = self.configuration.displays as AnyConfigurationModel[]
  return displays.filter(d => compatTypes.has(d.type))
}

function getDisplayConf(displays: DisplayConf[], displayId: string) {
  const displayConf = displays.find(d => d.displayId === displayId)
  if (!displayConf) {
    throw new Error(`could not find display config ${displayId}`)
  }
  return displayConf
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
      pinned: false,
      /**
       * #property
       */
      displays: types.array(pm.pluggableMstType('display', 'stateModel')),
    })
    .views(self => ({
      /**
       * #getter
       */
      get trackId() {
        return self.configuration.trackId as string
      },
      /**
       * #getter
       * determines which webworker to send the track to, currently based on trackId
       */
      get rpcSessionId() {
        const adapter = getConf(self, 'adapter')
        return adapter ? adapterConfigCacheKey(adapter) : this.trackId
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
      get adapterConfig() {
        return getConf(self, 'adapter')
      },

      /**
       * #getter
       */
      get adapterType() {
        const { adapterConfig } = self
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
          (adminMode || sessionTracks?.find(t => t.trackId === this.trackId))
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setPinned(flag: boolean) {
        self.pinned = flag
      },
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
        const displays = self.configuration.displays as DisplayConf[]
        const displayConf = getDisplayConf(displays, displayId)
        const displayType = pm.getDisplayType(displayConf.type)
        if (!displayType) {
          throw new Error(`unknown display type ${displayConf.type}`)
        }
        self.displays.push(
          displayType.stateModel.create({
            ...initialSnapshot,
            type: displayConf.type,
            configuration: displayId,
          }),
        )
      },

      /**
       * #action
       */
      hideDisplay(displayId: string) {
        const displaysToRemove = self.displays.filter(
          d => d.configuration.displayId === displayId,
        )
        for (const display of displaysToRemove) {
          self.displays.remove(display)
        }
        return displaysToRemove.length
      },

      /**
       * #action
       */
      replaceDisplay(
        oldDisplayId: string,
        newDisplayId: string,
        initialSnapshot = {},
      ) {
        const idx = self.displays.findIndex(
          d => d.configuration.displayId === oldDisplayId,
        )
        if (idx === -1) {
          throw new Error(
            `could not find display id ${oldDisplayId} to replace`,
          )
        }
        const displays = self.configuration.displays as DisplayConf[]
        const displayConf = getDisplayConf(displays, newDisplayId)
        const displayType = pm.getDisplayType(displayConf.type)
        if (!displayType) {
          throw new Error(`unknown display type ${displayConf.type}`)
        }
        self.displays.splice(idx, 1, {
          ...initialSnapshot,
          type: displayConf.type,
          configuration: newDisplayId,
        })
      },
    }))
    .views(() => ({
      saveTrackFileFormatOptions() {
        return {
          gff3: {
            name: 'GFF3',
            extension: 'gff3',
            callback: stringifyGFF3,
          },
          genbank: {
            name: 'GenBank',
            extension: 'gbk',
            callback: stringifyGBK,
            helpText:
              'Note: GenBank format export is experimental. The generated output may not fully conform to the GenBank specification and should be validated before use in production workflows.',
          },
          bed: {
            name: 'BED',
            extension: 'bed',
            callback: stringifyBED,
          },
        }
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        const menuItems: MenuItem[] = self.displays.flatMap(d =>
          d.trackMenuItems(),
        )
        const shownId = self.displays[0].configuration.displayId
        const compatDisp = getCompatibleDisplays(self)

        return [
          ...menuItems,
          {
            label: 'Save track data',
            icon: Save,
            priority: 998,
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                SaveTrackDataDlg,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
          ...(compatDisp.length > 1
            ? [
                {
                  type: 'subMenu' as const,
                  label: 'Display types',
                  priority: -1000,
                  subMenu: compatDisp.map(d => {
                    const displayType = pm.getDisplayType(d.type)!
                    return {
                      type: 'radio' as const,
                      label: displayType.displayName,
                      helpText: displayType.helpText,
                      checked: d.displayId === shownId,
                      onClick: () => {
                        if (d.displayId !== shownId) {
                          self.replaceDisplay(
                            shownId,
                            d.displayId,
                            self.displays[0].getPortableSettings?.() ?? {},
                          )
                        }
                      },
                    }
                  }),
                },
              ]
            : []),
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { minimized, pinned, ...rest } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(minimized ? { minimized } : {}),
        ...(pinned ? { pinned } : {}),
      } as typeof snap
    })
}

export type BaseTrackStateModel = ReturnType<typeof createBaseTrackModel>
export type BaseTrackModel = Instance<BaseTrackStateModel>
