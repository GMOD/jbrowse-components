import { lazy } from 'react'

import {
  getConf,
  isConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { createJBrowseTheme, defaultThemes } from '@jbrowse/core/ui'
import { Indexing } from '@jbrowse/core/ui/Icons'
import {
  getContainingView,
  isSessionModelWithWidgets,
  isSupportedIndexingAdapter,
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
import DeleteIcon from '@mui/icons-material/Delete'
import CopyIcon from '@mui/icons-material/FileCopy'
import InfoIcon from '@mui/icons-material/Info'
import Report from '@mui/icons-material/Report'
import SettingsIcon from '@mui/icons-material/Settings'
import { autorun, observable } from 'mobx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type {
  BaseTrackConfig,
  IBaseViewModel,
} from '@jbrowse/core/pluggableElementTypes'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type {
  AbstractSessionModel,
  AssemblyManager,
  DialogComponentType,
  NotificationLevel,
  SnackAction,
  TrackViewModel,
} from '@jbrowse/core/util'
import type { Menu } from '@jbrowse/app-core'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'
import type { JobsStateModel } from '../indexJobsModel'

export interface DesktopRootModelShape {
  version: string
  history: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void }
  menus: () => Menu[]
  assemblyManager: AssemblyManager
  jobsManager: JobsStateModel
  renameCurrentSession: (name: string) => void
}

// lazies
const AboutDialog = lazy(() => import('./AboutDialog'))
const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

const minDrawerWidth = 128

export type ThemeMap = Record<string, ThemeOptions>

export interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

export interface SnackbarMessage {
  message: string
  level?: NotificationLevel
  action?: SnackAction
}

/**
 * #stateModel JBrowseDesktopSessionModel
 *
 * Consolidated session model for jbrowse-desktop.
 * Includes functionality previously split across mixins:
 * - BaseSessionModel
 * - ReferenceManagementSessionMixin
 * - ConnectionManagementSessionMixin
 * - DrawerWidgetSessionMixin
 * - DialogQueueSessionMixin
 * - ThemeManagerSessionMixin
 * - TracksManagerSessionMixin
 * - MultipleViewsSessionMixin
 * - SessionAssembliesMixin
 * - TemporaryAssembliesMixin
 * - DesktopSessionTrackMenuMixin
 * - SnackbarModel
 * - AppFocusMixin
 */
export default function sessionModelFactory({
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
    .model('JBrowseDesktopSessionModel', {
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

      // SessionAssembliesMixin props
      sessionAssemblies: types.array(assemblyConfigSchema),

      // TemporaryAssembliesMixin props
      temporaryAssemblies: types.array(assemblyConfigSchema),

      // AppFocusMixin props
      focusedViewId: types.maybe(types.string),
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
      get root(): DesktopRootModelShape {
        return getParent<DesktopRootModelShape>(self)
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
      // Desktop is always admin mode
      get adminMode() {
        return true
      },
      get textSearchManager() {
        return getParent<{ textSearchManager: TextSearchManager }>(self)
          .textSearchManager
      },
    }))
    .views(self => ({
      // Tracks views - desktop doesn't have sessionTracks, uses jbrowse.tracks directly
      get tracks(): AnyConfigurationModel[] {
        return self.jbrowse.tracks
      },

      // Assemblies views
      get assemblies(): Instance<BaseAssemblyConfigSchema>[] {
        return [...self.jbrowse.assemblies, ...self.sessionAssemblies]
      },

      // Connections views
      get connections(): BaseConnectionConfigModel[] {
        return self.jbrowse.connections
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
      get assemblyNames(): string[] {
        return self.assemblies.map(a => readConfObject(a, 'name'))
      },
      get version() {
        return self.root.version
      },
      get history() {
        return self.root.history
      },
      get menus() {
        return self.root.menus
      },
      get assemblyManager(): AssemblyManager {
        return self.root.assemblyManager
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
      addConnectionConf(connectionConf: AnyConfigurationModel) {
        return self.jbrowse.addConnectionConf(connectionConf)
      },
      deleteConnection(configuration: AnyConfigurationModel) {
        return self.jbrowse.deleteConnectionConf(configuration)
      },

      // TracksManagerSessionMixin actions (desktop is always admin, so goes to jbrowse)
      addTrackConf(trackConf: AnyConfiguration) {
        return self.jbrowse.addTrackConf(trackConf)
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
        return self.jbrowse.deleteTrackConf(trackConf)
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
        // Desktop is always admin mode
        self.jbrowse.addAssemblyConf(conf)
      },
      removeAssembly(name: string) {
        // Desktop is always admin mode
        self.jbrowse.removeAssemblyConf(name)
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

      // Desktop-specific actions
      renameCurrentSession(sessionName: string) {
        self.root.renameCurrentSession(sessionName)
      },
      editTrackConfiguration(configuration: BaseTrackConfig) {
        this.editConfiguration(configuration)
      },

      afterAttach() {
        addDisposer(
          self,
          autorun(
            function sessionLocalStorageAutorun() {
              localStorageSetItem('drawerPosition', self.drawerPosition)
              localStorageSetItem('themeName', self.themeName)
              localStorageSetBoolean(
                'stickyViewHeaders',
                self.stickyViewHeaders,
              )
            },
            { name: 'SessionLocalStorage' },
          ),
        )
      },
    }))
    .views(self => ({
      // DesktopSessionTrackMenuMixin views
      getTrackActionMenuItems(trackConfig: BaseTrackConfig) {
        const trackSnapshot = structuredClone(getSnapshot(trackConfig)) as {
          trackId: string
          assemblyNames: string[]
          name: string
          displays: { displayId: string }[]
          category?: string
          adapter?: { type: string }
          textSearching?: {
            indexingAttributes?: string[]
            indexingFeatureTypesToExclude?: string[]
          }
        }
        return [
          {
            label: 'About track',
            onClick: () => {
              self.queueDialog(doneCallback => [
                AboutDialog,
                { config: trackConfig, handleClose: doneCallback },
              ])
            },
            icon: InfoIcon,
          },
          {
            label: 'Settings',
            onClick: () => {
              self.editConfiguration(trackConfig)
            },
            icon: SettingsIcon,
          },
          {
            label: 'Delete track',
            onClick: () => {
              self.deleteTrackConf(trackConfig)
            },
            icon: DeleteIcon,
          },
          {
            label: 'Copy track',
            onClick: () => {
              const now = Date.now()
              trackSnapshot.trackId += `-${now}`
              for (const d of trackSnapshot.displays) {
                d.displayId += `-${now}`
              }
              trackSnapshot.name += ' (copy)'
              trackSnapshot.category = undefined
              self.addTrackConf(trackSnapshot)
            },
            icon: CopyIcon,
          },
          ...(isSupportedIndexingAdapter(trackSnapshot.adapter?.type)
            ? [
                {
                  label: trackSnapshot.textSearching
                    ? 'Re-index track'
                    : 'Index track',
                  onClick: () => {
                    const { jobsManager } = self.root
                    const { trackId, assemblyNames, textSearching, name } =
                      trackSnapshot
                    const indexName = `${name}-index`
                    jobsManager.queueJob({
                      indexingParams: {
                        attributes: textSearching?.indexingAttributes || [
                          'Name',
                          'ID',
                        ],
                        exclude:
                          textSearching?.indexingFeatureTypesToExclude || [
                            'CDS',
                            'exon',
                          ],
                        assemblies: assemblyNames,
                        tracks: [trackId],
                        indexType: 'perTrack',
                        timestamp: new Date().toISOString(),
                        name: indexName,
                      },
                      name: indexName,
                    })
                  },
                  icon: Indexing,
                },
              ]
            : []),
          { type: 'divider' },
        ]
      },
    }))

  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as typeof sessionModel

  return types.snapshotProcessor(extendedSessionModel, {
    // @ts-expect-error
    preProcessor(snapshot) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (snapshot) {
        // @ts-expect-error
        const { connectionInstances, ...rest } = snapshot
        // connectionInstances schema changed from object to an array, so any old
        // connectionInstances as object is in snapshot, filter it out
        // https://github.com/GMOD/jbrowse-components/issues/1903
        if (!Array.isArray(connectionInstances)) {
          return rest
        }
      }
      return snapshot
    },
  })
}

export type DesktopSessionModelType = ReturnType<typeof sessionModelFactory>
export type DesktopSessionModel = Instance<DesktopSessionModelType>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<DesktopSessionModelType>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
