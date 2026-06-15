import { Indexing } from '@jbrowse/core/ui/Icons'
import { isSupportedIndexingAdapter } from '@jbrowse/core/util'
import {
  getParent,
  getSnapshot,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  copyTrackSnapshot,
  trackActionItems,
  trackActionMenuItems,
  trackListMenuItems,
} from '@jbrowse/product-core'
import {
  defaultAttributesToIndex,
  defaultFeatureTypesToExclude,
} from '@jbrowse/text-indexing'

import type { DesktopRootModel } from '../rootModel/rootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackActionView } from '@jbrowse/core/util/types'
import type {
  BaseSession,
  SessionWithDrawerWidgets,
  SessionWithTracks,
} from '@jbrowse/product-core'

type SessionBase = BaseSession & SessionWithTracks & SessionWithDrawerWidgets

/**
 * #stateModel DesktopSessionTrackMenuMixin
 */
export function DesktopSessionTrackMenuMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .views(self => ({
      /**
       * #method
       * raw track actions (Settings, Copy, Delete, Index) without submenu wrapper
       */
      getTrackActions(
        trackConfig: BaseTrackConfig,
        view?: TrackActionView,
      ): MenuItem[] {
        const session = self as SessionBase
        // snapshot kept for the Index action's adapter/textSearching reads
        const base = structuredClone(
          isStateTreeNode(trackConfig) ? getSnapshot(trackConfig) : trackConfig,
        )
        return [
          ...trackActionItems({
            session,
            config: trackConfig,
            view,
            // desktop is always admin; copies go to the top level
            canEdit: true,
            makeCopy: () =>
              copyTrackSnapshot(trackConfig, { clearCategory: true }),
          }),
          ...(isSupportedIndexingAdapter(base.adapter?.type)
            ? [
                {
                  label: base.textSearching ? 'Re-index track' : 'Index track',
                  onClick: () => {
                    const rootModel = getParent<DesktopRootModel>(self)
                    const { trackId, assemblyNames, textSearching } = base
                    rootModel.jobsManager.queueJob({
                      indexingParams: {
                        attributes:
                          textSearching?.indexingAttributes ??
                          defaultAttributesToIndex,
                        exclude:
                          textSearching?.indexingFeatureTypesToExclude ??
                          defaultFeatureTypesToExclude,
                        assemblies: assemblyNames,
                        tracks: [trackId],
                        indexType: 'perTrack',
                        timestamp: new Date().toISOString(),
                        name: trackId,
                      },
                      // jobs are keyed by name; trackId is unique so two tracks
                      // sharing a display name won't collide
                      name: trackId,
                    })
                  },
                  icon: Indexing,
                },
              ]
            : []),
        ]
      },
    }))
    .views(self => ({
      /**
       * #method
       * flattened menu items for use in hierarchical track selector
       */
      getTrackListMenuItems(
        trackConfig: BaseTrackConfig,
        view?: TrackActionView,
      ): MenuItem[] {
        return trackListMenuItems(
          self as unknown as SessionBase,
          trackConfig,
          self.getTrackActions(trackConfig, view),
        )
      },

      /**
       * #method
       */
      getTrackActionMenuItems({
        config,
        effectiveConfig,
        extraTrackActions,
        view,
      }: {
        config: BaseTrackConfig
        effectiveConfig: Record<string, unknown>
        extraTrackActions?: MenuItem[]
        view?: TrackActionView
      }): MenuItem[] {
        return trackActionMenuItems(
          self as unknown as SessionBase,
          effectiveConfig,
          self.getTrackActions(config, view),
          extraTrackActions,
        )
      },
    }))
}
