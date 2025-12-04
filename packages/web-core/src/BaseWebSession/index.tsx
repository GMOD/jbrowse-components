import { lazy } from 'react'

import {
  getConf,
  isConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  getContainingView,
  isSessionModelWithWidgets,
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageSetBoolean,
  localStorageSetItem,
} from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  addDisposer,
  cast,
  getMembers,
  getParent,
  getSnapshot,
  getType,
  isAlive,
  isModelType,
  isReferenceType,
  types,
  walk,
} from '@jbrowse/mobx-state-tree'
import { createJBrowseTheme, defaultThemes } from '@jbrowse/core/ui'
import { autorun, observable } from 'mobx'
import DeleteIcon from '@mui/icons-material/Delete'
import CopyIcon from '@mui/icons-material/FileCopy'
import InfoIcon from '@mui/icons-material/Info'
import SettingsIcon from '@mui/icons-material/Settings'
import Report from '@mui/icons-material/Report'

import type { Menu } from '@jbrowse/app-core'
import type { PluginDefinition } from '@jbrowse/core/PluginLoader'
import type PluginManager from '@jbrowse/core/PluginManager'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type {
  AssemblyManager,
  DialogComponentType,
  JBrowsePlugin,
  NotificationLevel,
  SnackAction,
  TrackViewModel,
} from '@jbrowse/core/util/types'
import type {
  IAnyStateTreeNode,
  Instance,
  SnapshotIn,
} from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

// lazies
const AboutDialog = lazy(() => import('./AboutDialog'))
const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

const minDrawerWidth = 128

export type ThemeMap = Record<string, ThemeOptions>

export interface Display {
  displayId: string
}

export interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

export interface SnackbarMessage {
  message: string
  level?: NotificationLevel
  action?: SnackAction
}

export interface WebRootModel {
  version: string
  textSearchManager: TextSearchManager
  assemblyManager: AssemblyManager
  savedSessionMetadata: unknown
  previousAutosaveId: string | undefined
  history: unknown
  setPluginsUpdated: (flag: boolean) => void
  addSavedSession: (session: unknown) => unknown
  deleteSavedSession: (id: string) => unknown
  favoriteSavedSession: (id: string) => unknown
  unfavoriteSavedSession: (id: string) => unknown
  renameCurrentSession: (name: string) => unknown
  duplicateCurrentSession: () => unknown
  activateSession: (name: string) => unknown
  setDefaultSession: () => unknown
  saveSessionToLocalStorage: () => unknown
  loadAutosaveSession: () => unknown
  setSession: (session: unknown) => unknown
  menus: () => Menu[]
}

/**
 * #stateModel BaseWebSession
 * used for "web based" products, including jbrowse-web and react-app
 *
 * Consolidated from the following mixins:
 * - ReferenceManagementSessionMixin
 * - DrawerWidgetSessionMixin
 * - DialogQueueSessionMixin
 * - ThemeManagerSessionMixin
 * - MultipleViewsSessionMixin
 * - SessionTracksManagerSessionMixin
 * - SessionAssembliesMixin
 * - TemporaryAssembliesMixin
 * - WebSessionConnectionsMixin (ConnectionManagementSessionMixin + session connections)
 * - AppFocusMixin
 * - SnackbarModel
 */
export function BaseWebSession({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  const widgetStateModelType = pluginManager.pluggableMstType(
    'widget',
    'stateModel',
  )
  type WidgetStateModel = Instance<typeof widgetStateModelType>

  const sessionModel = types
    .model('WebCoreSessionModel', {
      // BaseSessionModel props
      id: ElementId,
      name: types.string,
      margin: 0,

      // DrawerWidgetSessionMixin props
      drawerPosition: types.optional(
        types.string,
        () => localStorageGetItem('drawerPosition') || 'right',
      ),
      drawerWidth: types.optional(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      ),
      widgets: types.map(widgetStateModelType),
      activeWidgets: types.map(types.safeReference(widgetStateModelType)),
      minimized: types.optional(types.boolean, false),

      // MultipleViewsSessionMixin props
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
      stickyViewHeaders: types.optional(types.boolean, () =>
        localStorageGetBoolean('stickyViewHeaders', true),
      ),

      // ConnectionManagementSessionMixin props
      connectionInstances: types.array(
        pluginManager.pluggableMstType('connection', 'stateModel'),
      ),

      // SessionTracksManagerSessionMixin props
      sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      ),

      // SessionAssembliesMixin props
      sessionAssemblies: types.array(assemblyConfigSchema),

      // TemporaryAssembliesMixin props
      temporaryAssemblies: types.array(assemblyConfigSchema),

      // WebSessionConnectionsMixin props
      sessionConnections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),

      // AppFocusMixin props
      focusedViewId: types.maybe(types.string),

      // BaseWebSession props
      sessionPlugins: types.array(types.frozen()),
    })
    .volatile(() => ({
      // BaseSessionModel volatiles
      selection: undefined as unknown,
      hovered: undefined as unknown,

      // DialogQueueSessionMixin volatile
      queueOfDialogs: [] as [DialogComponentType, unknown][],

      // ThemeManagerSessionMixin volatile
      sessionThemeName: localStorageGetItem('themeName') || 'default',

      // SnackbarModel volatile
      snackbarMessages: observable.array<SnackbarMessage>(),

      // Task volatile
      task: undefined,
    }))
    .views(self => ({
      get root(): WebRootModel {
        return getParent<WebRootModel>(self)
      },
      get jbrowse() {
        return getParent<{ jbrowse: AnyConfigurationModel }>(self).jbrowse
      },
      get rpcManager(): RpcManager {
        return getParent<{ rpcManager: RpcManager }>(self).rpcManager
      },
      get configuration() {
        return this.jbrowse.configuration
      },
      get adminMode() {
        return getParent<{ adminMode: boolean }>(self).adminMode
      },
    }))
    .views(self => ({
      // Tracks views
      get tracks(): AnyConfigurationModel[] {
        return [...self.sessionTracks, ...self.jbrowse.tracks]
      },

      // Assemblies views
      get assemblies(): Instance<BaseAssemblyConfigSchema>[] {
        return [...self.jbrowse.assemblies, ...self.sessionAssemblies]
      },

      // Connections views
      get connections(): BaseConnectionConfigModel[] {
        return [...self.jbrowse.connections, ...self.sessionConnections]
      },

      // DrawerWidgetSessionMixin views
      get visibleWidget() {
        if (isAlive(self)) {
          return [...self.activeWidgets.values()][self.activeWidgets.size - 1]
        }
        return undefined
      },

      // DialogQueueSessionMixin views
      get DialogComponent() {
        return self.queueOfDialogs[0]?.[0]
      },
      get DialogProps() {
        return self.queueOfDialogs[0]?.[1]
      },

      // ThemeManagerSessionMixin views
      allThemes(): ThemeMap {
        const extraThemes = readConfObject(self.jbrowse, 'extraThemes')
        return { ...defaultThemes, ...extraThemes }
      },
      get themeName() {
        const { sessionThemeName } = self
        const all = this.allThemes()
        return all[sessionThemeName] ? sessionThemeName : 'default'
      },
      get theme() {
        const configTheme = readConfObject(self.jbrowse, 'theme')
        const all = this.allThemes()
        return createJBrowseTheme(configTheme, all, this.themeName)
      },

      // SnackbarModel views
      get snackbarMessageSet() {
        return new Map(self.snackbarMessages.map(s => [s.message, s]))
      },

      // ReferenceManagementSessionMixin views
      getReferring(object: IAnyStateTreeNode) {
        const refs: ReferringNode[] = []
        walk(getParent(self), node => {
          if (isModelType(getType(node))) {
            const members = getMembers(node)
            for (const [key, value] of Object.entries(members.properties)) {
              if (isReferenceType(value) && node[key] === object) {
                refs.push({ node, key })
              }
            }
          }
        })
        return refs
      },
    }))
    .views(self => ({
      get assemblyNames() {
        return self.assemblies.map(f => readConfObject(f, 'name') as string)
      },
      get version() {
        return self.root.version
      },
      get shareURL() {
        return readConfObject(self.jbrowse, 'shareURL')
      },
      get textSearchManager(): TextSearchManager {
        return self.root.textSearchManager
      },
      get assemblyManager(): AssemblyManager {
        return self.root.assemblyManager
      },
      get savedSessionMetadata() {
        return self.root.savedSessionMetadata
      },
      get previousAutosaveId() {
        return self.root.previousAutosaveId
      },
      get history() {
        return self.root.history
      },

      renderProps() {
        return {
          theme: self.theme,
          highResolutionScaling: getConf(self, 'highResolutionScaling'),
        }
      },
    }))
    .actions(self => ({
      // BaseSessionModel actions
      setSelection(thing: unknown) {
        self.selection = thing
      },
      clearSelection() {
        self.selection = undefined
      },
      setHovered(thing: unknown) {
        self.hovered = thing
      },

      setName(str: string) {
        self.name = str
      },

      // DialogQueueSessionMixin actions
      removeActiveDialog() {
        self.queueOfDialogs = self.queueOfDialogs.slice(1)
      },
      queueDialog(
        cb: (doneCallback: () => void) => [DialogComponentType, unknown],
      ) {
        const [component, props] = cb(() => {
          this.removeActiveDialog()
        })
        self.queueOfDialogs = [...self.queueOfDialogs, [component, props]]
      },

      // ThemeManagerSessionMixin actions
      setThemeName(name: string) {
        self.sessionThemeName = name
      },

      // DrawerWidgetSessionMixin actions
      setDrawerPosition(arg: string) {
        self.drawerPosition = arg
        localStorage.setItem('drawerPosition', arg)
      },
      updateDrawerWidth(drawerWidth: number) {
        if (drawerWidth === self.drawerWidth) {
          return self.drawerWidth
        }
        let newDrawerWidth = drawerWidth
        if (newDrawerWidth < minDrawerWidth) {
          newDrawerWidth = minDrawerWidth
        }
        self.drawerWidth = newDrawerWidth
        return newDrawerWidth
      },
      resizeDrawer(distance: number) {
        if (self.drawerPosition === 'left') {
          distance *= -1
        }
        const oldDrawerWidth = self.drawerWidth
        const newDrawerWidth = this.updateDrawerWidth(oldDrawerWidth - distance)
        return oldDrawerWidth - newDrawerWidth
      },
      addWidget(
        typeName: string,
        id: string,
        initialState = {},
        conf?: unknown,
      ) {
        const typeDefinition = pluginManager.getElementType('widget', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown widget type ${typeName}`)
        }
        const data = {
          ...initialState,
          id,
          type: typeName,
          configuration: conf || { type: typeName },
        }
        self.widgets.set(id, data)
        return self.widgets.get(id)
      },
      showWidget(widget: WidgetStateModel) {
        if (self.activeWidgets.has(widget.id)) {
          self.activeWidgets.delete(widget.id)
        }
        self.activeWidgets.set(widget.id, widget)
        self.minimized = false
      },
      hasWidget(widget: WidgetStateModel) {
        return self.activeWidgets.has(widget.id)
      },
      hideWidget(widget: WidgetStateModel) {
        self.activeWidgets.delete(widget.id)
      },
      minimizeWidgetDrawer() {
        self.minimized = true
      },
      showWidgetDrawer() {
        self.minimized = false
      },
      hideAllWidgets() {
        self.activeWidgets.clear()
      },
      editConfiguration(configuration: AnyConfigurationModel) {
        if (!isConfigurationModel(configuration)) {
          throw new Error(
            'must pass a configuration model to editConfiguration',
          )
        }
        const editor = this.addWidget(
          'ConfigurationEditorWidget',
          'configEditor',
          { target: configuration },
        )
        this.showWidget(editor)
      },

      // MultipleViewsSessionMixin actions
      moveViewDown(id: string) {
        const idx = self.views.findIndex(v => v.id === id)
        if (idx !== -1 && idx < self.views.length - 1) {
          self.views.splice(idx, 2, self.views[idx + 1], self.views[idx])
        }
      },
      moveViewUp(id: string) {
        const idx = self.views.findIndex(view => view.id === id)
        if (idx > 0) {
          self.views.splice(idx - 1, 2, self.views[idx], self.views[idx - 1])
        }
      },
      moveViewToTop(id: string) {
        const idx = self.views.findIndex(view => view.id === id)
        self.views = cast([
          self.views[idx],
          ...self.views.filter(view => view.id !== id),
        ])
      },
      moveViewToBottom(id: string) {
        const idx = self.views.findIndex(view => view.id === id)
        self.views = cast([
          ...self.views.filter(view => view.id !== id),
          self.views[idx],
        ])
      },
      addView(typeName: string, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown view type ${typeName}`)
        }
        const length = self.views.push({
          ...initialState,
          type: typeName,
        })
        return self.views[length - 1]
      },
      removeView(view: IBaseViewModel) {
        for (const [, widget] of self.activeWidgets) {
          if (widget.view && widget.view.id === view.id) {
            this.hideWidget(widget)
          }
        }
        self.views.remove(view)
      },
      setStickyViewHeaders(sticky: boolean) {
        self.stickyViewHeaders = sticky
      },

      // ReferenceManagementSessionMixin actions
      removeReferring(
        referring: ReferringNode[],
        track: BaseTrackConfig,
        callbacks: (() => void)[],
        dereferenceTypeCount: Record<string, number>,
      ) {
        for (const { node } of referring) {
          let dereferenced = false
          try {
            const type = 'open track(s)'
            const view = getContainingView(node) as TrackViewModel
            callbacks.push(() => {
              view.hideTrack(track.trackId)
            })
            dereferenced = true
            if (!dereferenceTypeCount[type]) {
              dereferenceTypeCount[type] = 0
            }
            dereferenceTypeCount[type] += 1
          } catch {
            // ignore
          }

          if (isSessionModelWithWidgets(self) && self.widgets.has(node.id)) {
            const type = 'configuration editor widget(s)'
            callbacks.push(() => {
              this.hideWidget(node)
            })
            dereferenced = true
            if (!dereferenceTypeCount[type]) {
              dereferenceTypeCount[type] = 0
            }
            dereferenceTypeCount[type] += 1
          }
          if (!dereferenced) {
            throw new Error(
              `Error when closing this connection, the following node is still referring to a track configuration: ${JSON.stringify(
                getSnapshot(node),
              )}`,
            )
          }
        }
      },

      // ConnectionManagementSessionMixin actions
      makeConnection(
        configuration: AnyConfigurationModel,
        initialSnapshot = {},
      ) {
        const type = configuration.type as string
        if (!type) {
          throw new Error('track configuration has no `type` listed')
        }
        const name = readConfObject(configuration, 'name')
        const connectionType = pluginManager.getConnectionType(type)
        if (!connectionType) {
          throw new Error(`unknown connection type ${type}`)
        }
        const length = self.connectionInstances.push({
          ...initialSnapshot,
          name,
          type,
          configuration,
        })
        return self.connectionInstances[length - 1]
      },
      prepareToBreakConnection(configuration: AnyConfigurationModel) {
        const callbacksToDeref: (() => void)[] = []
        const derefTypeCount: Record<string, number> = {}
        const name = readConfObject(configuration, 'name')
        const connection = self.connectionInstances.find(c => c.name === name)
        if (!connection) {
          return undefined
        }
        for (const track of connection.tracks) {
          const ref = self.getReferring(track)
          this.removeReferring(ref, track, callbacksToDeref, derefTypeCount)
        }
        return [
          () => {
            for (const cb of callbacksToDeref) {
              cb()
            }
            this.breakConnection(configuration)
          },
          derefTypeCount,
        ]
      },
      breakConnection(configuration: AnyConfigurationModel) {
        const name = readConfObject(configuration, 'name')
        const connection = self.connectionInstances.find(c => c.name === name)
        if (!connection) {
          throw new Error(`no connection found with name ${name}`)
        }
        self.connectionInstances.remove(connection)
      },
      clearConnections() {
        self.connectionInstances.clear()
      },

      // WebSessionConnectionsMixin actions (extends ConnectionManagementSessionMixin)
      addConnectionConf(connectionConf: BaseConnectionConfigModel) {
        if (self.adminMode) {
          return self.jbrowse.addConnectionConf(connectionConf)
        } else {
          const { connectionId, type } = connectionConf
          if (!type) {
            throw new Error(`unknown connection type "${type}"`)
          }
          const connection = self.sessionConnections.find(
            c => c.connectionId === connectionId,
          )
          if (connection) {
            return connection
          } else {
            const length = self.sessionConnections.push(connectionConf)
            return self.sessionConnections[length - 1]
          }
        }
      },
      deleteConnection(configuration: AnyConfigurationModel) {
        if (self.adminMode) {
          return self.jbrowse.deleteConnectionConf(configuration)
        } else {
          const { connectionId } = configuration
          const idx = self.sessionConnections.findIndex(
            c => c.connectionId === connectionId,
          )
          return idx === -1
            ? undefined
            : self.sessionConnections.splice(idx, 1)
        }
      },

      // TracksManagerSessionMixin / SessionTracksManagerSessionMixin actions
      addTrackConf(trackConf: AnyConfiguration) {
        if (self.adminMode) {
          return self.jbrowse.addTrackConf(trackConf)
        }
        const { trackId, type } = trackConf as {
          type: string
          trackId: string
        }
        if (!type) {
          throw new Error(`unknown track type ${type}`)
        }
        const track = self.sessionTracks.find(t => t.trackId === trackId)
        if (track) {
          return track
        }
        const length = self.sessionTracks.push(trackConf)
        return self.sessionTracks[length - 1]
      },
      deleteTrackConf(trackConf: AnyConfigurationModel) {
        const callbacksToDereferenceTrack: (() => void)[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        const referring = self.getReferring(trackConf)
        this.removeReferring(
          referring,
          trackConf,
          callbacksToDereferenceTrack,
          dereferenceTypeCount,
        )
        for (const cb of callbacksToDereferenceTrack) {
          cb()
        }

        // try to delete from jbrowse config if in admin mode
        if (self.adminMode) {
          const found = self.jbrowse.deleteTrackConf(trackConf)
          if (found) {
            return found
          }
        }

        // try to delete from sessionTracks
        const { trackId } = trackConf
        const idx = self.sessionTracks.findIndex(t => t.trackId === trackId)
        if (idx === -1) {
          return undefined
        }
        return self.sessionTracks.splice(idx, 1)
      },

      // SessionAssembliesMixin actions
      addSessionAssembly(conf: AnyConfiguration) {
        const asm = self.sessionAssemblies.find(f => f.name === conf.name)
        if (asm) {
          console.warn(`Assembly ${conf.name} already exists`)
          return asm
        }
        const length = self.sessionAssemblies.push(conf)
        return self.sessionAssemblies[length - 1]
      },
      addAssembly(conf: AnyConfiguration) {
        if (self.adminMode) {
          self.jbrowse.addAssemblyConf(conf)
        } else {
          this.addSessionAssembly(conf)
        }
      },
      removeAssembly(name: string) {
        if (self.adminMode) {
          self.jbrowse.removeAssemblyConf(name)
        } else {
          this.removeSessionAssembly(name)
        }
      },
      removeSessionAssembly(assemblyName: string) {
        const elt = self.sessionAssemblies.find(a => a.name === assemblyName)
        if (elt) {
          self.sessionAssemblies.remove(elt)
        }
      },

      // TemporaryAssembliesMixin actions
      addTemporaryAssembly(conf: AnyConfiguration) {
        const asm = self.temporaryAssemblies.find(f => f.name === conf.name)
        if (asm) {
          console.warn(`Assembly ${conf.name} was already existing`)
          return asm
        }
        const length = self.temporaryAssemblies.push(conf)
        return self.temporaryAssemblies[length - 1]
      },
      removeTemporaryAssembly(name: string) {
        const elt = self.temporaryAssemblies.find(a => a.name === name)
        if (elt) {
          self.temporaryAssemblies.remove(elt)
        }
      },

      // AppFocusMixin actions
      setFocusedViewId(viewId: string) {
        self.focusedViewId = viewId
      },

      // SnackbarModel actions
      notify(message: string, level?: NotificationLevel, action?: SnackAction) {
        this.pushSnackbarMessage(message, level, action)
        if (level === 'info' || level === 'success') {
          setTimeout(() => {
            this.removeSnackbarMessage(message)
          }, 5000)
        }
      },
      notifyError(errorMessage: string, error?: unknown, extra?: unknown) {
        this.notify(errorMessage, 'error', {
          name: <Report />,
          onClick: () => {
            this.queueDialog((onClose: () => void) => [
              ErrorMessageStackTraceDialog,
              { onClose, error, extra },
            ])
          },
        })
      },
      pushSnackbarMessage(
        message: string,
        level?: NotificationLevel,
        action?: SnackAction,
      ) {
        if (action || !self.snackbarMessageSet.has(message)) {
          self.snackbarMessages.push({ message, level, action })
        }
      },
      popSnackbarMessage() {
        return self.snackbarMessages.pop()
      },
      removeSnackbarMessage(message: string) {
        const element = self.snackbarMessageSet.get(message)
        if (element !== undefined) {
          self.snackbarMessages.remove(element)
        }
      },

      // BaseWebSession actions
      addAssemblyConf(conf: AnyConfiguration) {
        self.jbrowse.addAssemblyConf(conf)
      },
      addSessionPlugin(plugin: JBrowsePlugin) {
        if (self.sessionPlugins.some(p => p.name === plugin.name)) {
          throw new Error('session plugin cannot be installed twice')
        }
        self.sessionPlugins.push(plugin)
        self.root.setPluginsUpdated(true)
      },
      removeSessionPlugin(pluginDefinition: PluginDefinition) {
        self.sessionPlugins = cast(
          self.sessionPlugins.filter(
            plugin =>
              // @ts-expect-error
              plugin.url !== pluginDefinition.url ||
              // @ts-expect-error
              plugin.umdUrl !== pluginDefinition.umdUrl ||
              // @ts-expect-error
              plugin.cjsUrl !== pluginDefinition.cjsUrl ||
              // @ts-expect-error
              plugin.esmUrl !== pluginDefinition.esmUrl,
          ),
        )
        getParent<{ setPluginsUpdated: (flag: boolean) => void }>(
          self,
        ).setPluginsUpdated(true)
      },
      addSavedSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return self.root.addSavedSession(sessionSnapshot)
      },
      deleteSavedSession(id: string) {
        return self.root.deleteSavedSession(id)
      },
      favoriteSavedSession(id: string) {
        return self.root.favoriteSavedSession(id)
      },
      unfavoriteSavedSession(id: string) {
        return self.root.unfavoriteSavedSession(id)
      },
      renameCurrentSession(sessionName: string) {
        return self.root.renameCurrentSession(sessionName)
      },
      duplicateCurrentSession() {
        return self.root.duplicateCurrentSession()
      },
      activateSession(sessionName: string) {
        return self.root.activateSession(sessionName)
      },
      setDefaultSession() {
        return self.root.setDefaultSession()
      },
      saveSessionToLocalStorage() {
        return self.root.saveSessionToLocalStorage()
      },
      loadAutosaveSession() {
        return self.root.loadAutosaveSession()
      },
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return self.root.setSession(sessionSnapshot)
      },
    }))
    .actions(self => ({
      editTrackConfiguration(configuration: AnyConfigurationModel) {
        const { adminMode, sessionTracks } = self
        if (!adminMode && !sessionTracks.includes(configuration)) {
          throw new Error("Can't edit the configuration of a non-session track")
        }
        self.editConfiguration(configuration)
      },
    }))
    .views(self => ({
      getTrackActionMenuItems(config: BaseTrackConfig) {
        const { adminMode, sessionTracks } = self
        const canEdit =
          adminMode || sessionTracks.find(t => t.trackId === config.trackId)

        // disable if it is a reference sequence track
        const isRefSeq = config.type === 'ReferenceSequenceTrack'
        return [
          {
            label: 'About track',
            priority: 1002,
            onClick: () => {
              self.queueDialog(handleClose => [
                AboutDialog,
                {
                  config,
                  handleClose,
                },
              ])
            },
            icon: InfoIcon,
          },
          {
            label: 'Settings',
            priority: 1001,
            disabled: !canEdit,
            icon: SettingsIcon,
            onClick: () => {
              self.editTrackConfiguration(config)
            },
          },
          {
            label: 'Delete track',
            priority: 1000,
            disabled: !canEdit || isRefSeq,
            icon: DeleteIcon,
            onClick: () => {
              self.deleteTrackConf(config)
            },
          },
          {
            label: 'Copy track',
            priority: 999,
            disabled: isRefSeq,
            onClick: () => {
              const snap = structuredClone(getSnapshot(config)) as {
                [key: string]: unknown
                displays: Display[]
              }
              const now = Date.now()
              snap.trackId += `-${now}`
              for (const display of snap.displays) {
                display.displayId += `-${now}`
              }
              // the -sessionTrack suffix to trackId is used as metadata for
              // the track selector to store the track in a special category,
              // and default category is also cleared
              if (!self.adminMode) {
                snap.trackId += '-sessionTrack'
                snap.category = undefined
              }
              snap.name += ' (copy)'
              self.addTrackConf(snap)
            },
            icon: CopyIcon,
          },
          { type: 'divider' },
        ]
      },

      menus(): Menu[] {
        return self.root.menus()
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function sessionLocalStorageAutorun() {
              localStorageSetItem('drawerPosition', self.drawerPosition)
              localStorageSetItem('themeName', self.themeName)
              localStorageSetBoolean('stickyViewHeaders', self.stickyViewHeaders)
            },
            { name: 'SessionLocalStorage' },
          ),
        )
      },
    }))

  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as typeof sessionModel

  return types.snapshotProcessor(extendedSessionModel, {
    // @ts-expect-error
    preProcessor(snapshot) {
      // @ts-expect-error

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const { connectionInstances, ...rest } = snapshot || {}

      // connectionInstances schema changed from object to an array, so any old
      // connectionInstances as object is in snapshot, filter it out
      // xref https://github.com/GMOD/jbrowse-components/issues/1903
      return !Array.isArray(connectionInstances) ? rest : snapshot
    },
  })
}
