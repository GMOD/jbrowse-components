import {
  AppSessionMixin,
  AssembliesMixin,
  WorkspaceLayoutMixin,
} from '@jbrowse/app-core'
import { getConf } from '@jbrowse/core/configuration'
import {
  restoreFileHandles,
  restoreFileHandlesFromSnapshot,
} from '@jbrowse/core/util/tracks'
import {
  cast,
  flow,
  getParent,
  getSnapshot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  MultipleViewsSessionMixin,
  PreferencesSessionMixin,
  ReferenceManagementSessionMixin,
  SessionTracksManagerSessionMixin,
  ThemeManagerSessionMixin,
  TrackMenuItemsSessionMixin,
  copyTrackSnapshot,
  finalizeSession,
  trackActionItems,
} from '@jbrowse/product-core'

import { WebSessionConnectionsMixin } from '../SessionConnections.ts'

import type { AbstractWebRootModel } from '../WebRootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { AnyConfiguration } from '@jbrowse/core/configuration'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackActionView } from '@jbrowse/core/util/types'

/**
 * #stateModel BaseWebSessionModel
 *
 * Composable web session shared by jbrowse-web and react-app, before
 * `finalizeSession` (the snapshotProcessor can't be `compose`d).
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
      // nested to stay within types.compose's 10-argument limit
      types.compose(
        WorkspaceLayoutMixin(),
        TrackMenuItemsSessionMixin(pluginManager),
      ),
    )
    .props({
      /**
       * #property
       */
      sessionPlugins: types.array(
        types.frozen<PluginDefinition & { name: string }>(),
      ),
    })
    .volatile(() => ({
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
        // session plugins are unique by name (enforced in addSessionPlugin), so
        // identity is the name — not the resolved url, whose field priority
        // (cjs > esm > umd) makes a full stored def and a url-only removal
        // descriptor for the same plugin resolve to different urls
        self.sessionPlugins = cast(
          self.sessionPlugins.filter(p => p.name !== pluginDefinition.name),
        )
        self.root.setPluginsUpdated()
      },

      /**
       * #action
       */
      // the snapshot is typed the way the root that consumes it types it, not
      // as `SnapshotIn<typeof self>`: the latter is this whole composed model's
      // snapshot, and naming it here makes the emitted .d.ts inline the entire
      // session shape into this one signature — past the length tsc will
      // serialize (TS7056), which fails the packed build for every consumer.
      setSession(sessionSnapshot: Record<string, unknown>) {
        self.root.setSession(sessionSnapshot)
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
          // a non-admin's copy is routed to sessionTracks (see addTrackConf) and
          // the selector groups it under "Session tracks" from that membership;
          // clear the original category so it isn't also nested there
          makeCopy: () =>
            copyTrackSnapshot(config, {
              clearCategory: !self.adminMode,
            }),
        })
      },
    }))
    .actions(self => ({
      setPendingFileHandleIds(ids: string[]) {
        self.pendingFileHandleIds = ids
      },
    }))
    .actions(self => ({
      afterAttach() {
        // themeName is persisted by ThemeManagerSessionMixin's own autorun,
        // which writes the *raw* selection rather than the `themeName` getter's
        // coerced one — a second writer here overwrote it with 'default'
        // whenever the chosen theme wasn't currently registered, permanently
        // losing the selection instead of restoring it once the plugin
        // providing that theme loads again.
        //
        // The IndexedDB round-trip below outlives a session swap (setSession
        // destroys this node), so the result lands on a dead node unless the
        // write is gated on liveness.
        restoreFileHandlesFromSnapshot(getSnapshot(self), false)
          .then(results => {
            const failed = results.filter(r => !r.success)
            if (failed.length > 0 && isAlive(self)) {
              self.setPendingFileHandleIds(failed.map(f => f.handleId))
            }
          })
          .catch((err: unknown) => {
            console.error('Error restoring file handles:', err)
            if (isAlive(self)) {
              self.notifyError(`Error restoring file handles: ${err}`, err)
            }
          })
      },
      restorePendingFileHandles: flow(function* restorePendingFileHandles() {
        const results: Awaited<ReturnType<typeof restoreFileHandles>> =
          yield restoreFileHandles(self.pendingFileHandleIds, true)
        if (isAlive(self)) {
          self.setPendingFileHandleIds(
            results.filter(r => !r.success).map(r => r.handleId),
          )
        }
      }),
    }))
}

/**
 * Finalized web session without the session-database management surface, used
 * by the embedded react-app; jbrowse-web composes `WebSessionManagementMixin`
 * before finalizing. This is just {@link BaseWebSessionModel} run through
 * `finalizeSession`, so its state-model shape is documented there (the
 * autogen documents a single composable model per source file).
 */
export function BaseWebSession(args: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return finalizeSession(args.pluginManager, BaseWebSessionModel(args))
}
