/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import {
  SessionWithWidgets,
  NotificationLevel,
  AbstractSessionModel,
} from '@gmod/jbrowse-core/util/types'
import { getContainingView } from '@gmod/jbrowse-core/util'
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
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  readConfObject,
  isConfigurationModel,
} from '@gmod/jbrowse-core/configuration'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'
import { ReferringNode } from '../types'

export default function sessionModelFactory(
  pluginManager: PluginManager,
  editableConfigs = false,
) {
  const minDrawerWidth = 128
  const session = types
    .model('JBrowseWebSessionModel', {
      name: types.identifier,
      margin: 0,
      drawerWidth: types.optional(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      ),
      view: pluginManager.getViewType('LinearGenomeView').stateModel,
      widgets: types.map(
        pluginManager.pluggableMstType('drawer widget', 'stateModel'),
      ),
      activeWidgets: types.map(
        types.safeReference(
          pluginManager.pluggableMstType('drawer widget', 'stateModel'),
        ),
      ),
      connectionInstances: types.map(
        types.array(pluginManager.pluggableMstType('connection', 'stateModel')),
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
      get rpcManager() {
        return getParent(self).config.rpcManager as RpcManager
      },
      get configuration() {
        return getParent(self).config.configuration
      },
      get assemblies() {
        return [getParent(self).config.assembly]
      },
      get assemblyNames() {
        return [getParent(self).config.assemblyName]
      },
      get tracks() {
        return getParent(self).config.tracks
      },
      get connections() {
        return getParent(self).config.connections
      },
      get savedSessions() {
        return getParent(self).config.savedSessions
      },
      get savedSessionNames() {
        return getParent(self).config.savedSessionNames
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

      get visibleWidget() {
        if (isAlive(self))
          // returns most recently added item in active drawer widgets
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
      removeView() {},
      addView() {},
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

      prepareToBreakConnection(configuration: AnyConfigurationModel) {
        const name = readConfObject(configuration, 'name')
        const assemblyName = readConfObject(configuration, 'assemblyName')
        const assemblyConnections =
          self.connectionInstances.get(assemblyName) || []
        const connection = assemblyConnections.find(c => c.name === name)
        const callbacksToDereferenceTrack: Function[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        connection.tracks.forEach((track: any) => {
          const referring = self.getReferring(track)
          referring.forEach(({ node }: ReferringNode) => {
            let dereferenced = false
            try {
              // If a view is referring to the track config, remove the track
              // from the view
              const type = 'open track(s)'
              const view = getContainingView(node)
              callbacksToDereferenceTrack.push(() => view.hideTrack(track))
              dereferenced = true
              if (!dereferenceTypeCount[type]) dereferenceTypeCount[type] = 0
              dereferenceTypeCount[type] += 1
            } catch (err1) {
              // ignore
            }
            if (this.hasWidget(node)) {
              // If a configuration editor drawer widget has the track config
              // open, close the drawer widget
              const type = 'configuration editor drawer widget(s)'
              callbacksToDereferenceTrack.push(() => this.hideWidget(node))
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
        })
        const safelyBreakConnection = () => {
          callbacksToDereferenceTrack.forEach(cb => cb())
          this.breakConnection(configuration)
        }
        return [safelyBreakConnection, dereferenceTypeCount]
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

      addAssemblyConf(assemblyConf: any) {
        return getParent(self).config.addAssemblyConf(assemblyConf)
      },

      addTrackConf(trackConf: any) {
        return getParent(self).config.addTrackConf(trackConf)
      },

      addConnectionConf(connectionConf: any) {
        return getParent(self).config.addConnectionConf(connectionConf)
      },

      addWidget(
        typeName: string,
        id: string,
        initialState = {},
        configuration = { type: typeName },
      ) {
        const typeDefinition = pluginManager.getElementType(
          'drawer widget',
          typeName,
        )
        if (!typeDefinition)
          throw new Error(`unknown drawer widget type ${typeName}`)
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
        return getParent(self).config.addSavedSession(sessionSnapshot)
      },

      removeSavedSession(sessionSnapshot: any) {
        return getParent(self).config.removeSavedSession(sessionSnapshot)
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

  if (!editableConfigs) {
    return session
  }

  return types.compose(
    'EditableConfigSession',
    session,
    types.model().actions(self => ({
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
        const editableConfigSession = self as SessionWithWidgets
        const editor = editableConfigSession.addWidget(
          'ConfigurationEditorWidget',
          'configEditor',
          { target: configuration },
        )
        editableConfigSession.showWidget(editor)
      },
    })),
  )
}

export type SessionStateModel = ReturnType<typeof sessionModelFactory>

/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-ignore
function z(x: Instance<SessionStateModel>): AbstractSessionModel {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
