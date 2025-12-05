import { lazy } from 'react'

import {
  isConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  getContainingView,
  isSessionModelWithWidgets,
  localStorageGetItem,
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
import InfoIcon from '@mui/icons-material/Info'
import Report from '@mui/icons-material/Report'
import { autorun, observable } from 'mobx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type {
  AssemblyManager,
  DialogComponentType,
  NotificationLevel,
  SnackAction,
  TrackViewModel,
} from '@jbrowse/core/util'
import type { AbstractSessionModel } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'

// lazies
const AboutDialog = lazy(() => import('./AboutDialog'))
const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

const minDrawerWidth = 128

export interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

export interface SnackbarMessage {
  message: string
  level?: NotificationLevel
  action?: SnackAction
}

export interface LGVRootModel {
  config: {
    assembly: AnyConfigurationModel
    assemblyName: string
    connections: BaseConnectionConfigModel[]
    configuration: AnyConfigurationModel
  }
  version: string
  disableAddTracks: boolean
  assemblyManager: AssemblyManager
  rpcManager: RpcManager
  textSearchManager: TextSearchManager
  adminMode: boolean
  jbrowse: {
    tracks: AnyConfigurationModel[]
    addTrackConf: (conf: AnyConfiguration) => AnyConfigurationModel
    deleteTrackConf: (conf: AnyConfigurationModel) => AnyConfigurationModel
    connections: BaseConnectionConfigModel[]
    addConnectionConf: (conf: AnyConfigurationModel) => unknown
    deleteConnectionConf: (conf: AnyConfigurationModel) => unknown
  }
}

/**
 * #stateModel JBrowseReactLinearGenomeViewSessionModel
 *
 * Consolidated session model for jbrowse-react-linear-genome-view.
 * Includes functionality previously split across mixins:
 * - BaseSessionModel
 * - DrawerWidgetSessionMixin
 * - ConnectionManagementSessionMixin
 * - DialogQueueSessionMixin
 * - TracksManagerSessionMixin
 * - ReferenceManagementSessionMixin
 * - SessionTracksManagerSessionMixin
 * - SnackbarModel
 */
export default function sessionModelFactory(pluginManager: PluginManager) {
  const widgetStateModelType = pluginManager.pluggableMstType(
    'widget',
    'stateModel',
  )
  type WidgetStateModel = Instance<typeof widgetStateModelType>

  return types
    .model('ReactLinearGenomeViewSession', {
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

      // ConnectionManagementSessionMixin props
      connectionInstances: types.array(
        pluginManager.pluggableMstType('connection', 'stateModel'),
      ),

      // View prop (single view for LGV)
      view: pluginManager.getViewType('LinearGenomeView')!
        .stateModel as LinearGenomeViewStateModel,

      // SessionTracksManagerSessionMixin props
      sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      ),
    })
    .volatile(() => ({
      // BaseSessionModel volatiles
      selection: undefined as unknown,
      hovered: undefined as unknown,

      // DialogQueueSessionMixin volatile
      queueOfDialogs: [] as [DialogComponentType, unknown][],

      // SnackbarModel volatile
      snackbarMessages: observable.array<SnackbarMessage>(),
    }))
    .views(self => ({
      // Root access
      get root(): LGVRootModel {
        return getParent<LGVRootModel>(self)
      },
    }))
    .views(self => ({
      // Properties from root
      get jbrowse() {
        return self.root.jbrowse
      },
      get rpcManager() {
        return self.root.rpcManager
      },
      get configuration() {
        return self.root.config.configuration
      },
      get adminMode() {
        return self.root.adminMode
      },
      get textSearchManager() {
        return self.root.textSearchManager
      },
      get version() {
        return self.root.version
      },
      get disableAddTracks() {
        return self.root.disableAddTracks
      },
      get assemblies() {
        return [self.root.config.assembly]
      },
      get assemblyNames() {
        return [self.root.config.assemblyName]
      },
      get connections(): BaseConnectionConfigModel[] {
        return self.root.config.connections
      },
      get assemblyManager() {
        return self.root.assemblyManager
      },

      // View access
      get views() {
        return [self.view]
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
      // Tracks views - depends on jbrowse from previous views block
      get tracks(): AnyConfigurationModel[] {
        return [...self.sessionTracks, ...self.jbrowse.tracks]
      },

      renderProps() {
        return {
          theme: readConfObject(self.configuration, 'theme'),
          highResolutionScaling: readConfObject(
            self.configuration,
            'highResolutionScaling',
          ),
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
      deleteConnection(configuration: AnyConfigurationModel) {
        return self.jbrowse.deleteConnectionConf(configuration)
      },
      addConnectionConf(connectionConf: AnyConfigurationModel) {
        return self.jbrowse.addConnectionConf(connectionConf)
      },
      clearConnections() {
        self.connectionInstances.clear()
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

      // View actions
      addView(typeName: string, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown view type ${typeName}`)
        }
        self.view = cast({
          ...initialState,
          type: typeName,
        })
        return self.view
      },
      removeView() {},

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

      afterAttach() {
        addDisposer(
          self,
          autorun(
            function drawerPositionAutorun() {
              localStorageSetItem('drawerPosition', self.drawerPosition)
            },
            { name: 'DrawerPosition' },
          ),
        )
      },
    }))
    .views(self => ({
      getTrackActionMenuItems(config: AnyConfigurationModel) {
        return [
          {
            label: 'About track',
            onClick: () => {
              self.queueDialog(doneCallback => [
                AboutDialog,
                { config, handleClose: doneCallback },
              ])
            },
            icon: InfoIcon,
          },
        ]
      },
    }))
}

export type LGVSessionModelType = ReturnType<typeof sessionModelFactory>
export type LGVSessionModel = Instance<LGVSessionModelType>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<LGVSessionModelType>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
