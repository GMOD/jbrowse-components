import { lazy } from 'react'

import {
  AppFocusMixin,
  DockviewLayoutMixin,
  SessionAssembliesMixin,
  TemporaryAssembliesMixin,
} from '@jbrowse/app-core'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import SnackbarModel from '@jbrowse/core/ui/SnackbarModel'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import {
  restoreFileHandles,
  restoreFileHandlesFromSnapshot,
} from '@jbrowse/core/util/tracks'
import {
  addDisposer,
  cast,
  getParent,
  getSnapshot,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  DialogQueueSessionMixin,
  MultipleViewsSessionMixin,
  ReferenceManagementSessionMixin,
  SessionTracksManagerSessionMixin,
  ThemeManagerSessionMixin,
} from '@jbrowse/product-core'
import DeleteIcon from '@mui/icons-material/Delete'
import CopyIcon from '@mui/icons-material/FileCopy'
import InfoIcon from '@mui/icons-material/Info'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SettingsIcon from '@mui/icons-material/Settings'
import { autorun } from 'mobx'

import { WebSessionConnectionsMixin } from '../SessionConnections.ts'

import type { Menu } from '@jbrowse/app-core'
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
import type { AssemblyManager } from '@jbrowse/core/util/types'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

// lazies
const AboutDialog = lazy(() => import('./AboutDialog.tsx'))

interface Display {
  displayId: string
}

/**
 * #stateModel BaseWebSession
 * used for "web based" products, including jbrowse-web and react-app
 * composed of
 * - [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)
 * - [DialogQueueSessionMixin](../dialogqueuesessionmixin)
 * - [ThemeManagerSessionMixin](../thememanagersessionmixin)
 * - [MultipleViewsSessionMixin](../multipleviewssessionmixin)
 * - [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)
 * - [SessionAssembliesMixin](../sessionassembliesmixin)
 * - [TemporaryAssembliesMixin](../temporaryassembliesmixin)
 * - [WebSessionConnectionsMixin](../websessionconnectionsmixin)
 * - [AppFocusMixin](../appfocusmixin)
 */
export function BaseWebSession({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  const sessionModel = types
    .compose(
      'WebCoreSessionModel',
      types.compose(
        'WebCoreSessionModelGroupA',
        ReferenceManagementSessionMixin(pluginManager),
        DialogQueueSessionMixin(pluginManager),
        ThemeManagerSessionMixin(pluginManager),
        MultipleViewsSessionMixin(pluginManager),
      ),
      types.compose(
        'WebCoreSessionModelGroupB',
        SessionTracksManagerSessionMixin(pluginManager),
        SessionAssembliesMixin(pluginManager, assemblyConfigSchema),
        TemporaryAssembliesMixin(pluginManager, assemblyConfigSchema),
        WebSessionConnectionsMixin(pluginManager),
        DockviewLayoutMixin(),
        AppFocusMixin(),
        SnackbarModel(),
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
    .volatile((/* self */) => ({
      /**
       * #volatile
       */
      sessionThemeName: localStorageGetItem('themeName') || 'default',
      /**
       * #volatile
       * this is the current "task" that is being performed in the UI. this is
       * usually an object of the form
       *
       * `{ taskName: "configure", target: thing_being_configured }`
       */
      task: undefined,
      /**
       * #volatile
       */
      pendingFileHandleIds: [] as string[],
    }))
    .views(self => ({
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return [...self.sessionTracks, ...self.jbrowse.tracks]
      },
      /**
       * #getter
       */
      get root() {
        return getParent<any>(self)
      },
      /**
       * #getter
       * list of sessionAssemblies and jbrowse config assemblies, does not
       * include temporaryAssemblies. basically the list to be displayed in a
       * AssemblySelector dropdown
       */
      get assemblies(): (Instance<BaseAssemblyConfigSchema> & {
        sequence: { trackId: string }
      })[] {
        return [...self.jbrowse.assemblies, ...self.sessionAssemblies]
      },
      /**
       * #getter
       * list of config connections and session connections
       */
      get connections(): BaseConnectionConfigModel[] {
        return [...self.jbrowse.connections, ...self.sessionConnections]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setName(str: string) {
        self.name = str
      },
    }))

    .views(self => ({
      /**
       * #getter
       * list of sessionAssemblies and jbrowse config assemblies, does not
       * include temporaryAssemblies. basically the list to be displayed in a
       * AssemblySelector dropdown
       */
      get assemblyNames() {
        return self.assemblies.map(f => readConfObject(f, 'name') as string)
      },
      /**
       * #getter
       */
      get version() {
        return self.root.version
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
      /**
       * #getter
       */
      get assemblyManager(): AssemblyManager {
        return self.root.assemblyManager
      },
      /**
       * #getter
       */
      get savedSessionMetadata() {
        return self.root.savedSessionMetadata
      },

      /**
       * #getter
       */
      get history() {
        return self.root.history
      },

      /**
       * #method
       */
      renderProps() {
        return {
          theme: self.theme,
          highResolutionScaling: getConf(self, 'highResolutionScaling'),
        }
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
        self.root.setPluginsUpdated(true)
      },

      /**
       * #action
       */
      removeSessionPlugin(pluginDefinition: PluginDefinition) {
        type PluginUrls = Partial<{
          url: string
          umdUrl: string
          cjsUrl: string
          esmUrl: string
        }>
        const def = pluginDefinition as PluginUrls
        self.sessionPlugins = cast(
          self.sessionPlugins.filter(plugin => {
            const p = plugin as PluginUrls
            return (
              p.url !== def.url ||
              p.umdUrl !== def.umdUrl ||
              p.cjsUrl !== def.cjsUrl ||
              p.esmUrl !== def.esmUrl
            )
          }),
        )
        self.root.setPluginsUpdated(true)
      },

      /**
       * #action
       */
      deleteSavedSession(id: string) {
        return self.root.deleteSavedSession(id)
      },

      /**
       * #action
       */
      setSavedSessionFavorite(id: string, favorite: boolean) {
        return self.root.setSavedSessionFavorite(id, favorite)
      },
      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        return self.root.renameCurrentSession(sessionName)
      },

      /**
       * #action
       */
      activateSession(sessionName: string) {
        return self.root.activateSession(sessionName)
      },

      /**
       * #action
       */
      setDefaultSession() {
        return self.root.setDefaultSession()
      },

      /**
       * #action
       */
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return self.root.setSession(sessionSnapshot)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      editTrackConfiguration(
        configuration: AnyConfigurationModel | { trackId: string },
      ) {
        const { adminMode, sessionTracks } = self
        const trackId = configuration.trackId
        const isSessionTrack = sessionTracks.some(t => t.trackId === trackId)
        if (!adminMode && !isSessionTrack) {
          throw new Error("Can't edit the configuration of a non-session track")
        }
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
        view?: { showTrack: (id: string) => void },
      ): MenuItem[] {
        const { adminMode, sessionTracks } = self
        const canEdit =
          adminMode || sessionTracks.some(t => t.trackId === config.trackId)
        const isRefSeq = config.type === 'ReferenceSequenceTrack'
        const makeSnap = () => {
          const snap = structuredClone(
            isStateTreeNode(config) ? getSnapshot(config) : config,
          ) as { [key: string]: unknown; displays?: Display[] }
          const now = Date.now()
          snap.trackId += `-${now}`
          if (snap.displays) {
            for (const display of snap.displays) {
              display.displayId += `-${now}`
            }
          }
          // the -sessionTrack suffix to trackId is used as metadata for
          // the track selector to store the track in a special category,
          // and default category is also cleared
          if (!self.adminMode) {
            snap.trackId += '-sessionTrack'
            snap.category = undefined
          }
          snap.name += ' (copy)'
          return snap
        }
        return [
          {
            label: 'Settings',
            disabled: !canEdit,
            icon: SettingsIcon,
            onClick: () => {
              self.editTrackConfiguration(config)
            },
          },
          {
            label: 'Copy track',
            disabled: isRefSeq,
            onClick: () => {
              self.addTrackConf(makeSnap())
            },
            icon: CopyIcon,
          },
          {
            label: 'Copy and open track',
            disabled: isRefSeq || !view,
            onClick: () => {
              const snap = makeSnap()
              self.addTrackConf(snap)
              view!.showTrack(snap.trackId as string)
            },
            icon: OpenInNewIcon,
          },
          {
            label: 'Delete track',
            disabled: !canEdit || isRefSeq,
            icon: DeleteIcon,
            onClick: () => {
              self.deleteTrackConf(config)
            },
          },
        ]
      },
    }))
    .views(self => ({
      /**
       * #method
       * flattened menu items for use in hierarchical track selector
       */
      getTrackListMenuItems(
        config: BaseTrackConfig,
        view?: { showTrack: (id: string) => void },
      ): MenuItem[] {
        return [
          {
            label: 'About track',
            onClick: () => {
              self.queueDialog(handleClose => [
                AboutDialog,
                {
                  config,
                  handleClose,
                  session: self,
                },
              ])
            },
            icon: InfoIcon,
          },
          ...self.getTrackActions(config, view),
        ]
      },

      /**
       * #method
       * @param config - track configuration
       * @param extraTrackActions - additional items to merge into "Track actions" submenu
       */
      getTrackActionMenuItems(
        config: BaseTrackConfig,
        extraTrackActions?: MenuItem[],
        effectiveConfig?: Record<string, unknown>,
        view?: { showTrack: (id: string) => void },
      ): MenuItem[] {
        return [
          {
            label: 'About track',
            priority: 1002,
            onClick: () => {
              self.queueDialog(handleClose => [
                AboutDialog,
                {
                  config: effectiveConfig ?? config,
                  handleClose,
                  session: self,
                },
              ])
            },
            icon: InfoIcon,
          },
          {
            type: 'subMenu' as const,
            label: 'Track actions',
            priority: 1001,
            subMenu: [
              ...self.getTrackActions(config, view),
              ...(extraTrackActions || []),
            ],
          },
          { type: 'divider' as const },
        ]
      },

      /**
       * #method
       */
      menus(): Menu[] {
        return self.root.menus()
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
          })
      },
      async restorePendingFileHandles() {
        const results = await restoreFileHandles(
          self.pendingFileHandleIds,
          true,
        )
        self.setPendingFileHandleIds(
          results.filter(r => !r.success).map(r => r.handleId),
        )
      },
    }))

  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as typeof sessionModel

  return types.snapshotProcessor(extendedSessionModel, {
    preProcessor(
      snapshot: SnapshotIn<typeof extendedSessionModel> & {
        connectionInstances?: unknown
      },
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const { connectionInstances, ...rest } = snapshot || {}

      // connectionInstances schema changed from object to an array, so any old
      // connectionInstances as object is in snapshot, filter it out
      // xref https://github.com/GMOD/jbrowse-components/issues/1903
      return !Array.isArray(connectionInstances) ? rest : snapshot
    },
  })
}
