import { lazy } from 'react'

import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import Save from '@mui/icons-material/Save'
import { comparer, reaction } from 'mobx'

import { stringifyBED } from './saveTrackFileTypes/bed.ts'
import { stringifyGBK } from './saveTrackFileTypes/genbank.ts'
import { stringifyGFF3 } from './saveTrackFileTypes/gff3.ts'
import { ConfigurationReference, getConf } from '../../configuration/index.ts'
import { adapterConfigCacheKey } from '../../data_adapters/dataAdapterCache.ts'
import { getContainingView, getEnv, getSession } from '../../util/index.ts'
import { isSessionModelWithConfigEditing } from '../../util/types/index.ts'
import { ElementId } from '../../util/types/mst.ts'

import type PluginManager from '../../PluginManager.ts'
import type { FileTypeExporter } from './saveTrackFileTypes/types.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '../../configuration/index.ts'
import type { MenuItem } from '../../ui/index.ts'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

const SaveTrackDataDlg = lazy(() => import('./components/SaveTrackData.tsx'))

interface DisplayConf {
  displayId: string
  type: string
}

export function getCompatibleDisplays(self: IAnyStateTreeNode) {
  const { pluginManager } = getEnv(self)
  const view = getContainingView(self)
  const viewType = pluginManager.getViewType(view.type)
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
      minimized: types.stripDefault(types.boolean, false),
      /**
       * #property
       */
      pinned: types.stripDefault(types.boolean, false),
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
       * a shown track always has at least one display
       */
      get activeDisplay() {
        return self.displays[0]!
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
        const { sessionTracks, trackConfigDeltas, adminMode } = session
        return (
          isSessionModelWithConfigEditing(session) &&
          (adminMode === true ||
            !!sessionTracks?.find(t => t.trackId === this.trackId) ||
            this.trackId in (trackConfigDeltas ?? {}))
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get adapterType() {
        const { adapterConfig } = self
        if (!adapterConfig) {
          throw new Error(`no adapter configuration provided for ${self.type}`)
        }
        return pm.getAdapterType(adapterConfig.type)
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
        self.displays[idx] = {
          ...initialSnapshot,
          type: displayConf.type,
          configuration: newDisplayId,
        }
      },

      /**
       * #action
       * Persist any config-schema mutation (quick track-menu edits calling
       * `setSlot` directly, or the full Settings dialog) back to the session,
       * debounced, mirroring ConfigurationEditorWidget's own save. `reaction`
       * (not `autorun`) on purpose: `self.configuration` is defined
       * immediately on attach, unlike ConfigurationEditorWidget's `target`
       * (which starts undefined), so an autorun's guaranteed first run would
       * otherwise schedule a spurious flush for every track ever shown, even
       * completely untouched ones — `reaction` only fires on an actual change.
       *
       * `equals: comparer.structural` is load-bearing, not an optimization:
       * `self.configuration` is a re-resolving reference, and persisting a save
       * swaps the resolved node identity (admin `updateTrackConf` replaces the
       * frozen `jbrowse.tracks` entry, rehydrating a brand-new MST node; the
       * non-admin path reconciles in place but still churns once). Referential
       * comparison would treat every such swap as a fresh change and re-fire the
       * save, which for the admin/desktop path (new node every write) is an
       * unbounded debounced loop. Structural comparison settles once the content
       * stops changing.
       */
      afterAttach() {
        let timeout: ReturnType<typeof setTimeout> | undefined
        addDisposer(
          self,
          reaction(
            () => getSnapshot(self.configuration),
            snapshot => {
              clearTimeout(timeout)
              timeout = setTimeout(() => {
                const session = getSession(self)
                if (isSessionModelWithConfigEditing(session)) {
                  session.updateTrackConfiguration(
                    snapshot as { trackId: string; [key: string]: unknown },
                  )
                }
              }, 400)
            },
            { equals: comparer.structural },
          ),
        )
        addDisposer(self, () => {
          clearTimeout(timeout)
        })
      },
    }))
    .views(() => ({
      /**
       * #method
       */
      saveTrackFileFormatOptions(): Record<string, FileTypeExporter> {
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
       * #getter
       * the "Save track data" menu entry. Kept separate from trackMenuItems so
       * consumers (e.g. the LGV track-label menu) can place it alongside the
       * session's Settings/Copy/Delete track actions without fishing it back out
       * of the general list
       */
      get saveTrackDataMenuItem(): MenuItem {
        return {
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
        }
      },
      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        const menuItems = self.displays.flatMap(
          d => d.trackMenuItems() as MenuItem[],
        )
        const shownId = self.activeDisplay.configuration.displayId
        const compatDisp = getCompatibleDisplays(self)

        return [
          ...menuItems,
          ...(compatDisp.length > 1 && shownId
            ? [
                {
                  type: 'subMenu' as const,
                  label: 'Display types',
                  priority: -1000,
                  subMenu: compatDisp.map(d => {
                    const displayType = pm.getDisplayType(d.type)
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
                            self.displays[0].getPortableSettings?.(
                              d.displayId,
                            ) ?? {},
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
}

export type BaseTrackStateModel = ReturnType<typeof createBaseTrackModel>
export type BaseTrackModel = Instance<BaseTrackStateModel>
