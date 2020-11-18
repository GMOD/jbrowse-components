/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import {
  readConfObject,
  getConf,
  isConfigurationModel,
} from '@jbrowse/core/configuration'
import {
  Region,
  NotificationLevel,
  AbstractSessionModel,
  TrackViewModel,
} from '@jbrowse/core/util/types'
import { getContainingView } from '@jbrowse/core/util'
import { observable } from 'mobx'
import {
  getMembers,
  getParent,
  getSnapshot,
  getType,
  IAnyStateTreeNode,
  isAlive,
  isModelType,
  isReferenceType,
  SnapshotIn,
  types,
  walk,
  Instance,
} from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

import RpcManager from '@jbrowse/core/rpc/RpcManager'
import SettingsIcon from '@material-ui/icons/Settings'
import CopyIcon from '@material-ui/icons/FileCopy'
import DeleteIcon from '@material-ui/icons/Delete'
import shortid from 'shortid'

declare interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

export default function sessionModelFactory(pluginManager: PluginManager) {
  const minDrawerWidth = 128
  return types
    .model('JBrowseWebSessionModel', {
      id: types.optional(types.identifier, shortid()),
      name: types.string,
      margin: 0,
      drawerWidth: types.optional(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      ),
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
      widgets: types.map(
        pluginManager.pluggableMstType('widget', 'stateModel'),
      ),
      activeWidgets: types.map(
        types.safeReference(
          pluginManager.pluggableMstType('widget', 'stateModel'),
        ),
      ),
      connectionInstances: types.map(
        types.array(pluginManager.pluggableMstType('connection', 'stateModel')),
      ),
      sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      ),
    })
    .volatile((/* self */) => ({
      pluginManager,
      /**
       * this is the globally "selected" object. can be anything.
       * code that wants to deal with this should examine it to see what
       * kind of thing it is.
       */
      selection: undefined,
      /**
       * this is the current "task" that is being performed in the UI.
       * this is usually an object of the form
       * `{ taskName: "configure", target: thing_being_configured }`
       */
      task: undefined,
    }))
    .views(self => ({
      get shareURL() {
        return getConf(getParent(self).jbrowse, 'shareURL')
      },
      get rpcManager() {
        return getParent(self).jbrowse.rpcManager as RpcManager
      },
      get configuration() {
        return getParent(self).jbrowse.configuration
      },
      get assemblies() {
        return getParent(self).jbrowse.assemblies
      },
      get assemblyNames() {
        return getParent(self).jbrowse.assemblyNames
      },
      get tracks() {
        return [...self.sessionTracks, ...getParent(self).jbrowse.tracks]
      },
      get connections() {
        return getParent(self).jbrowse.connections
      },
      get adminMode() {
        return getParent(self).adminMode
      },
      get savedSessions() {
        return getParent(self).savedSessions
      },
      get previousAutosaveId() {
        return getParent(self).previousAutosaveId
      },
      get savedSessionNames() {
        return getParent(self).savedSessionNames
      },
      get history() {
        return getParent(self).history
      },
      get menus() {
        return getParent(self).menus
      },
      get assemblyManager() {
        return getParent(self).assemblyManager
      },
      get version() {
        return getParent(self).version
      },
      get renderProps() {
        return { theme: readConfObject(this.configuration, 'theme') }
      },
      get visibleWidget() {
        if (isAlive(self))
          // returns most recently added item in active widgets
          return Array.from(self.activeWidgets.values())[
            self.activeWidgets.size - 1
          ]
        return undefined
      },
      /**
       * See if any MST nodes currently have a types.reference to this object.
       * @param object - object
       * @returns An array where the first element is the node referring
       * to the object and the second element is they property name the node is
       * using to refer to the object
       */
      getReferring(object: IAnyStateTreeNode) {
        const refs: ReferringNode[] = []
        walk(getParent(self), node => {
          if (isModelType(getType(node))) {
            const members = getMembers(node)
            Object.entries(members.properties).forEach(([key, value]) => {
              // @ts-ignore
              if (isReferenceType(value) && node[key] === object) {
                refs.push({ node, key })
              }
            })
          }
        })
        return refs
      },
    }))
    .actions(self => ({
      setName(str: string) {
        self.name = str
      },

      makeConnection(
        configuration: AnyConfigurationModel,
        initialSnapshot = {},
      ) {
        const { type } = configuration
        if (!type) throw new Error('track configuration has no `type` listed')
        const name = readConfObject(configuration, 'name')
        const connectionType = pluginManager.getConnectionType(type)
        if (!connectionType) throw new Error(`unknown connection type ${type}`)
        const assemblyName = readConfObject(configuration, 'assemblyName')
        const connectionData = {
          ...initialSnapshot,
          name,
          type,
          configuration,
        }
        if (!self.connectionInstances.has(assemblyName))
          self.connectionInstances.set(assemblyName, [])
        const assemblyConnections = self.connectionInstances.get(assemblyName)
        if (!assemblyConnections)
          throw new Error(`assembly ${assemblyName} not found`)
        const length = assemblyConnections.push(connectionData)
        return assemblyConnections[length - 1]
      },

      removeReferring(
        referring: any,
        track: any,
        callbacks: Function[],
        dereferenceTypeCount: Record<string, number>,
      ) {
        referring.forEach(({ node }: ReferringNode) => {
          let dereferenced = false
          try {
            // If a view is referring to the track config, remove the track
            // from the view
            const type = 'open track(s)'
            const view = getContainingView(node) as TrackViewModel
            callbacks.push(() => view.hideTrack(track.trackId))
            dereferenced = true
            if (!dereferenceTypeCount[type]) {
              dereferenceTypeCount[type] = 0
            }
            dereferenceTypeCount[type] += 1
          } catch (err1) {
            // ignore
          }

          // @ts-ignore
          if (self.widgets.has(node.id)) {
            // If a configuration editor widget has the track config
            // open, close the widget
            const type = 'configuration editor widget(s)'
            callbacks.push(() => this.hideWidget(node))
            dereferenced = true
            if (!dereferenceTypeCount[type]) dereferenceTypeCount[type] = 0
            dereferenceTypeCount[type] += 1
          }
          if (!dereferenced)
            throw new Error(
              `Error when closing this connection, the following node is still referring to a track configuration: ${JSON.stringify(
                getSnapshot(node),
              )}`,
            )
        })
      },

      prepareToBreakConnection(configuration: AnyConfigurationModel) {
        const callbacksToDereferenceTrack: Function[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        const name = readConfObject(configuration, 'name')
        const assemblyName = readConfObject(configuration, 'assemblyName')
        const assemblyConnections =
          self.connectionInstances.get(assemblyName) || []
        const connection = assemblyConnections.find(c => c.name === name)
        if (connection) {
          connection.tracks.forEach((track: any) => {
            const referring = self.getReferring(track)
            this.removeReferring(
              referring,
              track,
              callbacksToDereferenceTrack,
              dereferenceTypeCount,
            )
          })
          const safelyBreakConnection = () => {
            callbacksToDereferenceTrack.forEach(cb => cb())
            this.breakConnection(configuration)
          }
          return [safelyBreakConnection, dereferenceTypeCount]
        }
        return undefined
      },

      breakConnection(configuration: AnyConfigurationModel) {
        const name = readConfObject(configuration, 'name')
        const assemblyName = readConfObject(configuration, 'assemblyName')
        const connectionInstances = self.connectionInstances.get(assemblyName)
        if (!connectionInstances)
          throw new Error(`connections for ${assemblyName} not found`)
        const connection = connectionInstances.find(c => c.name === name)
        connectionInstances.remove(connection)
      },

      deleteConnection(configuration: AnyConfigurationModel) {
        return getParent(self).jbrowse.deleteConnectionConf(configuration)
      },

      updateDrawerWidth(drawerWidth: number) {
        if (drawerWidth === self.drawerWidth) return self.drawerWidth
        let newDrawerWidth = drawerWidth
        if (newDrawerWidth < minDrawerWidth) newDrawerWidth = minDrawerWidth
        self.drawerWidth = newDrawerWidth
        return newDrawerWidth
      },

      resizeDrawer(distance: number) {
        const oldDrawerWidth = self.drawerWidth
        const newDrawerWidth = this.updateDrawerWidth(oldDrawerWidth - distance)
        const actualDistance = oldDrawerWidth - newDrawerWidth
        return actualDistance
      },

      addView(typeName: string, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) throw new Error(`unknown view type ${typeName}`)

        const length = self.views.push({
          ...initialState,
          type: typeName,
        })
        return self.views[length - 1]
      },

      removeView(view: any) {
        for (const [id, widget] of self.activeWidgets) {
          if (
            id === 'hierarchicalTrackSelector' &&
            widget.view &&
            widget.view.id === view.id
          )
            this.hideWidget(widget)
        }
        self.views.remove(view)
      },

      addAssemblyConf(assemblyConf: AnyConfigurationModel) {
        return getParent(self).jbrowse.addAssemblyConf(assemblyConf)
      },

      addTrackConf(trackConf: AnyConfigurationModel) {
        if (self.adminMode) {
          return getParent(self).jbrowse.addTrackConf(trackConf)
        }
        const { trackId, type } = trackConf
        if (!type) {
          throw new Error(`unknown track type ${type}`)
        }
        const track = self.sessionTracks.find((t: any) => t.trackId === trackId)
        if (track) {
          return track
        }
        const length = self.sessionTracks.push(trackConf)
        return self.sessionTracks[length - 1]
      },

      deleteTrackConf(trackConf: AnyConfigurationModel) {
        const callbacksToDereferenceTrack: Function[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        const referring = self.getReferring(trackConf)
        this.removeReferring(
          referring,
          trackConf,
          callbacksToDereferenceTrack,
          dereferenceTypeCount,
        )
        callbacksToDereferenceTrack.forEach(cb => cb())
        if (self.adminMode) {
          return getParent(self).jbrowse.deleteTrackConf(trackConf)
        }
        const { trackId } = trackConf
        const idx = self.sessionTracks.findIndex(t => t.trackId === trackId)
        if (idx === -1) {
          return undefined
        }
        return self.sessionTracks.splice(idx, 1)
      },

      addConnectionConf(connectionConf: any) {
        return getParent(self).jbrowse.addConnectionConf(connectionConf)
      },

      addLinearGenomeViewOfAssembly(assemblyName: string, initialState = {}) {
        return this.addViewOfAssembly(
          'LinearGenomeView',
          assemblyName,
          initialState,
        )
      },

      addViewOfAssembly(
        viewType: any,
        assemblyName: string,
        initialState: any = {},
      ) {
        const assembly = self.assemblies.find(
          (s: AnyConfigurationModel) =>
            readConfObject(s, 'name') === assemblyName,
        )
        if (!assembly)
          throw new Error(
            `Could not add view of assembly "${assemblyName}", assembly name not found`,
          )
        initialState.displayRegionsFromAssemblyName = readConfObject(
          assembly,
          'name',
        )
        return this.addView(viewType, initialState)
      },

      addViewFromAnotherView(
        viewType: string,
        otherView: any,
        initialState: { displayedRegions?: Region[] } = {},
      ) {
        const state = { ...initialState }
        state.displayedRegions = getSnapshot(otherView.displayedRegions)
        return this.addView(viewType, state)
      },

      addWidget(
        typeName: string,
        id: string,
        initialState = {},
        configuration = { type: typeName },
      ) {
        const typeDefinition = pluginManager.getElementType('widget', typeName)
        if (!typeDefinition) throw new Error(`unknown widget type ${typeName}`)
        const data = {
          ...initialState,
          id,
          type: typeName,
          configuration,
        }
        self.widgets.set(id, data)
        return self.widgets.get(id)
      },

      showWidget(widget: any) {
        if (self.activeWidgets.has(widget.id))
          self.activeWidgets.delete(widget.id)
        self.activeWidgets.set(widget.id, widget)
      },

      hasWidget(widget: any) {
        return self.activeWidgets.has(widget.id)
      },

      hideWidget(widget: any) {
        self.activeWidgets.delete(widget.id)
      },

      hideAllWidgets() {
        self.activeWidgets.clear()
      },

      /**
       * set the global selection, i.e. the globally-selected object.
       * can be a feature, a view, just about anything
       * @param thing -
       */
      setSelection(thing: any) {
        self.selection = thing
      },

      /**
       * clears the global selection
       */
      clearSelection() {
        self.selection = undefined
      },

      clearConnections() {
        self.connectionInstances.clear()
      },

      addSavedSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent(self).addSavedSession(sessionSnapshot)
      },

      removeSavedSession(sessionSnapshot: any) {
        return getParent(self).removeSavedSession(sessionSnapshot)
      },

      renameCurrentSession(sessionName: string) {
        return getParent(self).renameCurrentSession(sessionName)
      },

      duplicateCurrentSession() {
        return getParent(self).duplicateCurrentSession()
      },
      activateSession(sessionName: any) {
        return getParent(self).activateSession(sessionName)
      },
      setDefaultSession() {
        return getParent(self).setDefaultSession()
      },
      saveSessionToLocalStorage() {
        return getParent(self).saveSessionToLocalStorage()
      },
      loadAutosaveSession() {
        return getParent(self).loadAutosaveSession()
      },
    }))
    .extend(() => {
      const snackbarMessages = observable.array()

      return {
        views: {
          get snackbarMessages() {
            return snackbarMessages
          },
        },
        actions: {
          notify(message: string, level?: NotificationLevel) {
            return this.pushSnackbarMessage(message, level)
          },

          pushSnackbarMessage(message: string, level?: NotificationLevel) {
            return snackbarMessages.push([message, level])
          },

          popSnackbarMessage() {
            return snackbarMessages.pop()
          },
        },
      }
    })
    .actions(self => ({
      /**
       * opens a configuration editor to configure the given thing,
       * and sets the current task to be configuring it
       * @param configuration -
       */
      editConfiguration(configuration: AnyConfigurationModel) {
        if (!isConfigurationModel(configuration)) {
          throw new Error(
            'must pass a configuration model to editConfiguration',
          )
        }
        const editableConfigSession = self
        const editor = editableConfigSession.addWidget(
          'ConfigurationEditorWidget',
          'configEditor',
          { target: configuration },
        )
        editableConfigSession.showWidget(editor)
      },
      editTrackConfiguration(configuration: AnyConfigurationModel) {
        if (
          !self.adminMode &&
          self.sessionTracks.indexOf(configuration) === -1
        ) {
          throw new Error("Can't edit the configuration of a non-session track")
        }
        this.editConfiguration(configuration)
      },
    }))
    .views(self => ({
      getTrackActionMenuItems(config: any) {
        const session = self
        const canEdit =
          session.adminMode ||
          session.sessionTracks.find((track: AnyConfigurationModel) => {
            return track.trackId === config.trackId
          })

        return [
          {
            label: 'Settings',
            disabled: !canEdit,
            onClick: () => {
              session.editTrackConfiguration(config)
            },
            icon: SettingsIcon,
          },
          {
            label: 'Delete track',
            disabled: !canEdit,
            onClick: () => {
              session.deleteTrackConf(config)
            },
            icon: DeleteIcon,
          },
          {
            label: 'Copy track',
            onClick: () => {
              const trackSnapshot = JSON.parse(
                JSON.stringify(getSnapshot(config)),
              )
              const now = Date.now()
              trackSnapshot.trackId += `-${now}`
              trackSnapshot.displays.forEach(
                (display: { displayId: string }) => {
                  display.displayId += `-${now}`
                },
              )
              // the -sessionTrack suffix to trackId is used as metadata for
              // the track selector to store the track in a special category,
              // and default category is also cleared
              if (!session.adminMode) {
                trackSnapshot.trackId += '-sessionTrack'
                trackSnapshot.category = undefined
              }
              trackSnapshot.name += ' (copy)'
              session.addTrackConf(trackSnapshot)
            },
            icon: CopyIcon,
          },
        ]
      },
    }))
}

export type SessionStateModel = ReturnType<typeof sessionModelFactory>
export type SessionModel = Instance<SessionStateModel>

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<SessionStateModel>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
