/* eslint-disable @typescript-eslint/no-explicit-any */
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { isConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { getContainingView } from '@gmod/jbrowse-core/util/tracks'
import jsonStableStringify from 'json-stable-stringify'
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
} from 'mobx-state-tree'

declare interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

export default function sessionModelFactory(pluginManager: any) {
  const minDrawerWidth = 128
  return types
    .model('JBrowseWebSessionModel', {
      name: types.identifier,
      margin: 0,
      drawerWidth: types.optional(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      ),
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
      drawerWidgets: types.map(
        pluginManager.pluggableMstType('drawer widget', 'stateModel'),
      ),
      activeDrawerWidgets: types.map(
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
       * { taskName: "configure", target: thing_being_configured }
       */
      task: undefined,
    }))
    .views(self => ({
      get rpcManager() {
        return getParent(self).jbrowse.rpcManager
      },
      get assemblyData() {
        return getParent(self).jbrowse.assemblyData
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
        return getParent(self).jbrowse.tracks
      },
      get connections() {
        return getParent(self).jbrowse.connections
      },
      get savedSessions() {
        return getParent(self).jbrowse.savedSessions
      },
      get savedSessionNames() {
        return getParent(self).jbrowse.savedSessionNames
      },
      get history() {
        return getParent(self).history
      },
      get menus() {
        return getParent(self).menus
      },

      get visibleDrawerWidget() {
        if (isAlive(self))
          // returns most recently added item in active drawer widgets
          return Array.from(self.activeDrawerWidgets.values())[
            self.activeDrawerWidgets.size - 1
          ]
        return undefined
      },
      /**
       * See if any MST nodes currently have a types.reference to this object.
       * @param {MSTNode} object object
       * @returns {Array} An array where the first element is the node referring
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
      getRegionsForAssemblyName(
        assemblyName: string,
        opts: { signal?: AbortSignal } = {},
      ) {
        const assembly = self.assemblyData.get(assemblyName)
        if (assembly) {
          const adapterConfig = readConfObject(assembly.sequence, 'adapter')
          const adapterConfigId = jsonStableStringify(adapterConfig)
          return self.rpcManager
            .call(
              adapterConfigId,
              'getRegions',
              {
                sessionId: assemblyName,
                adapterType: adapterConfig.type,
                adapterConfig,
                signal: opts.signal,
              },
              { timeout: 1000000 },
            )
            .then((adapterRegions: IRegion[]) => {
              const adapterRegionsWithAssembly = adapterRegions.map(
                adapterRegion => ({
                  ...adapterRegion,
                  assemblyName,
                }),
              )
              return adapterRegionsWithAssembly
            })
        }
        return Promise.resolve(undefined)
      },

      makeConnection(configuration: any, initialSnapshot = {}) {
        const { type } = configuration
        if (!type) throw new Error('track configuration has no `type` listed')
        const name = readConfObject(configuration, 'name')
        const connectionType = pluginManager.getConnectionType(type)
        if (!connectionType) throw new Error(`unknown connection type ${type}`)
        const assemblyName = readConfObject(configuration, 'assemblyName')
        const connectionData = { ...initialSnapshot, name, type, configuration }
        if (!self.connectionInstances.has(assemblyName))
          self.connectionInstances.set(assemblyName, [])
        const assemblyConnections = self.connectionInstances.get(assemblyName)
        if (!assemblyConnections)
          throw new Error(`assembly ${assemblyName} not found`)
        const length = assemblyConnections.push(connectionData)
        return assemblyConnections[length - 1]
      },

      prepareToBreakConnection(configuration: any) {
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
            if (this.hasDrawerWidget(node)) {
              // If a configuration editor drawer widget has the track config
              // open, close the drawer widget
              const type = 'configuration editor drawer widget(s)'
              callbacksToDereferenceTrack.push(() =>
                this.hideDrawerWidget(node),
              )
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

      breakConnection(configuration: any) {
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
        for (const [id, drawerWidget] of self.activeDrawerWidgets) {
          if (
            id === 'hierarchicalTrackSelector' &&
            drawerWidget.view &&
            drawerWidget.view.id === view.id
          )
            this.hideDrawerWidget(drawerWidget)
        }
        self.views.remove(view)
      },

      addAssemblyConf(assemblyConf: any) {
        return getParent(self).jbrowse.addAssemblyConf(assemblyConf)
      },

      addTrackConf(trackConf: any) {
        return getParent(self).jbrowse.addTrackConf(trackConf)
      },

      addConnectionConf(connectionConf: any) {
        return getParent(self).jbrowse.addConnectionConf(connectionConf)
      },

      addViewFromAnotherView(
        viewType: string,
        otherView: any,
        initialState: { displayedRegions?: IRegion[] } = {},
      ) {
        const state = { ...initialState }
        state.displayedRegions = getSnapshot(otherView.displayedRegions)
        return this.addView(viewType, state)
      },

      addDrawerWidget(
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
        self.drawerWidgets.set(id, data)
        return self.drawerWidgets.get(id)
      },

      showDrawerWidget(drawerWidget: any) {
        if (self.activeDrawerWidgets.has(drawerWidget.id))
          self.activeDrawerWidgets.delete(drawerWidget.id)
        self.activeDrawerWidgets.set(drawerWidget.id, drawerWidget)
      },

      hasDrawerWidget(drawerWidget: any) {
        return self.activeDrawerWidgets.has(drawerWidget.id)
      },

      hideDrawerWidget(drawerWidget: any) {
        self.activeDrawerWidgets.delete(drawerWidget.id)
      },

      hideAllDrawerWidgets() {
        self.activeDrawerWidgets.clear()
      },

      /**
       * set the global selection, i.e. the globally-selected object.
       * can be a feature, a view, just about anything
       * @param {object} thing
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

      /**
       * opens a configuration editor to configure the given thing,
       * and sets the current task to be configuring it
       * @param {*} configuration
       */
      editConfiguration(configuration: any) {
        if (!isConfigurationModel(configuration)) {
          throw new Error(
            'must pass a configuration model to editConfiguration',
          )
        }
        const editor = this.addDrawerWidget(
          'ConfigurationEditorDrawerWidget',
          'configEditor',
          { target: configuration },
        )
        this.showDrawerWidget(editor)
      },

      clearConnections() {
        self.connectionInstances.clear()
      },

      addSavedSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent(self).jbrowse.addSavedSession(sessionSnapshot)
      },

      removeSavedSession(sessionSnapshot: any) {
        return getParent(self).jbrowse.removeSavedSession(sessionSnapshot)
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
          pushSnackbarMessage(message: string) {
            return snackbarMessages.push(message)
          },

          popSnackbarMessage() {
            return snackbarMessages.pop()
          },
        },
      }
    })
}

export type SessionStateModel = ReturnType<typeof sessionModelFactory>

// a track is a combination of an assembly and a renderer, along with some conditions
// specifying in which contexts it is available (which assemblies, which views, etc)
