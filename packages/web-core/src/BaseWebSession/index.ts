import {
  AppSessionMixin,
  AssembliesMixin,
  DockviewLayoutMixin,
} from '@jbrowse/app-core'
import { pluginUrl } from '@jbrowse/core/PluginLoader'
import { getConf } from '@jbrowse/core/configuration'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import {
  restoreFileHandles,
  restoreFileHandlesFromSnapshot,
} from '@jbrowse/core/util/tracks'
import {
  addDisposer,
  cast,
  flow,
  getParent,
  getSnapshot,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  MultipleViewsSessionMixin,
  PreferencesSessionMixin,
  ReferenceManagementSessionMixin,
  SessionTracksManagerSessionMixin,
  ThemeManagerSessionMixin,
  copyTrackSnapshot,
  trackActionItems,
  trackActionMenuItems,
  trackListMenuItems,
} from '@jbrowse/product-core'
import { autorun } from 'mobx'

import { WebSessionConnectionsMixin } from '../SessionConnections.ts'

import type { AbstractWebRootModel } from '../WebRootModel.ts'
import type { PluginDefinition } from '@jbrowse/core/PluginLoader'
import type PluginManager from '@jbrowse/core/PluginManager'
import type TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackActionView } from '@jbrowse/core/util/types'
import type { IAnyModelType, SnapshotIn } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel BaseWebSessionModel
 *
 * Composable web session shared by jbrowse-web and react-app, before
 * {@link finalizeWebSession} (the snapshotProcessor can't be `compose`d).
 * jbrowse-web composes `WebSessionManagementMixin` onto this; react-app uses it
 * as-is.
 */
export function BaseWebSessionModel({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return types
    .compose(
      'WebCoreSessionModel',
      ReferenceManagementSessionMixin(pluginManager),
      ThemeManagerSessionMixin(pluginManager),
      MultipleViewsSessionMixin(pluginManager),
      PreferencesSessionMixin(pluginManager),
      SessionTracksManagerSessionMixin(pluginManager),
      AssembliesMixin(pluginManager, assemblyConfigSchema),
      AppSessionMixin(pluginManager),
      WebSessionConnectionsMixin(pluginManager),
      DockviewLayoutMixin(),
    )
    .props({
      /**
       * #property
       */
      sessionPlugins: types.array(
        types.frozen<PluginDefinition & { name: string }>(),
      ),
    })
    .volatile((/* self */) => ({
      /**
       * #volatile
       */
      sessionThemeName: localStorageGetItem('themeName') ?? 'default',
      /**
       * #volatile
       */
      pendingFileHandleIds: [] as string[],
    }))
    .views(self => ({
      // `tracks` (with session-override shadowing) comes from
      // SessionTracksManagerSessionMixin — no need to redefine it here
      /**
       * #getter
       */
      get root(): AbstractWebRootModel {
        return getParent<AbstractWebRootModel>(self)
      },
      /**
       * #getter
       * list of config connections and session connections
       */
      get connections(): BaseConnectionConfigModel[] {
        return [...self.jbrowse.connections, ...self.sessionConnections]
      },
    }))

    .views(self => ({
      /**
       * #method
       * whether the user may edit this track's config (admins may edit any;
       * everyone else only their own session tracks)
       */
      canEditTrack(trackId: string): boolean {
        return (
          self.adminMode || self.sessionTracks.some(t => t.trackId === trackId)
        )
      },

      /**
       * #method
       * whether `trackId` is a session-track edit (see updateTrackConfiguration)
       * shadowing an admin-owned config track of the same trackId, rather than a
       * standalone user-added session track
       */
      isTrackOverride(trackId: string): boolean {
        const configTracks = self.jbrowse.tracks as AnyConfigurationModel[]
        return (
          self.sessionTracks.some(t => t.trackId === trackId) &&
          configTracks.some(t => t.trackId === trackId)
        )
      },

      /**
       * #getter
       */
      get shareURL() {
        return getConf(self.jbrowse, 'shareURL')
      },
      /**
       * #getter
       */
      get textSearchManager(): TextSearchManager {
        return self.root.textSearchManager
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      addAssemblyConf(conf: AnyConfiguration) {
        self.jbrowse.addAssemblyConf(conf)
      },
      /**
       * #action
       */
      addSessionPlugin(plugin: PluginDefinition & { name: string }) {
        if (self.sessionPlugins.some(p => p.name === plugin.name)) {
          throw new Error('session plugin cannot be installed twice')
        }
        self.sessionPlugins.push(plugin)
        self.root.setPluginsUpdated()
      },

      /**
       * #action
       */
      removeSessionPlugin(pluginDefinition: PluginDefinition) {
        const targetUrl = pluginUrl(pluginDefinition)
        self.sessionPlugins = cast(
          self.sessionPlugins.filter(p => pluginUrl(p) !== targetUrl),
        )
        self.root.setPluginsUpdated()
      },

      /**
       * #action
       */
      setDefaultSession() {
        self.root.setDefaultSession()
      },

      /**
       * #action
       */
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        self.root.setSession(sessionSnapshot)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * opens the config editor for a track. Available for any track: edits to
       * a non-session (admin-owned) track apply in-memory for the current
       * session even when the user lacks rights to persist them.
       */
      editTrackConfiguration(
        configuration: AnyConfigurationModel | { trackId: string },
      ) {
        self.editConfiguration(configuration)
      },
    }))
    .views(self => ({
      /**
       * #method
       * raw track actions (Settings, Copy, Delete) without submenu wrapper
       */
      getTrackActions(
        config: BaseTrackConfig,
        view?: TrackActionView,
      ): MenuItem[] {
        return trackActionItems({
          session: self,
          config,
          view,
          canEdit: self.canEditTrack(config.trackId),
          isSessionOverride: self.isTrackOverride(config.trackId),
          // non-admin copies become session tracks (routed to a special
          // category, so the original category is also cleared)
          makeCopy: () =>
            copyTrackSnapshot(config, {
              sessionTrack: !self.adminMode,
              clearCategory: !self.adminMode,
            }),
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       * flattened menu items for use in hierarchical track selector
       */
      getTrackListMenuItems(
        config: BaseTrackConfig,
        view?: TrackActionView,
      ): MenuItem[] {
        return trackListMenuItems(
          self,
          config,
          self.getTrackActions(config, view),
        )
      },

      /**
       * #method
       * @param config - track configuration
       * @param extraTrackActions - additional items to merge into "Track actions" submenu
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
          self,
          effectiveConfig,
          self.getTrackActions(config, view),
          extraTrackActions,
        )
      },
    }))
    .actions(self => ({
      setPendingFileHandleIds(ids: string[]) {
        self.pendingFileHandleIds = ids
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function sessionLocalStorageAutorun() {
              localStorageSetItem('themeName', self.themeName)
            },
            { name: 'SessionLocalStorage' },
          ),
        )
        restoreFileHandlesFromSnapshot(getSnapshot(self), false)
          .then(results => {
            const failed = results.filter(r => !r.success)
            if (failed.length > 0) {
              self.setPendingFileHandleIds(failed.map(f => f.handleId))
            }
          })
          .catch((err: unknown) => {
            console.error('Error restoring file handles:', err)
            self.notifyError(`Error restoring file handles: ${err}`, err)
          })
      },
      restorePendingFileHandles: flow(function* restorePendingFileHandles() {
        const results: Awaited<ReturnType<typeof restoreFileHandles>> =
          yield restoreFileHandles(self.pendingFileHandleIds, true)
        self.setPendingFileHandleIds(
          results.filter(r => !r.success).map(r => r.handleId),
        )
      }),
    }))
}

/** Apply the `Core-extendSession` extension point + legacy snapshot processor. */
export function finalizeWebSession<T extends IAnyModelType>(
  pluginManager: PluginManager,
  sessionModel: T,
) {
  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as T

  return types.snapshotProcessor(extendedSessionModel, {
    preProcessor(
      snapshot: SnapshotIn<T> & {
        connectionInstances?: unknown
      },
    ) {
      const { connectionInstances, ...rest } = snapshot

      // connectionInstances schema changed from object to an array, so any old
      // connectionInstances as object is in snapshot, filter it out
      // xref https://github.com/GMOD/jbrowse-components/issues/1903
      return !Array.isArray(connectionInstances) ? rest : snapshot
    },
  })
}

/**
 * Finalized web session without the session-database management surface, used
 * by the embedded react-app; jbrowse-web composes `WebSessionManagementMixin`
 * before finalizing. This is just {@link BaseWebSessionModel} run through
 * {@link finalizeWebSession}, so its state-model shape is documented there (the
 * autogen documents a single composable model per source file).
 */
export function BaseWebSession(args: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return finalizeWebSession(args.pluginManager, BaseWebSessionModel(args))
}
