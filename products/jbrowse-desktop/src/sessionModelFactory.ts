/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy } from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import {
  readConfObject,
  isConfigurationModel,
} from '@jbrowse/core/configuration'
import {
  Region,
  TrackViewModel,
  DialogComponentType,
} from '@jbrowse/core/util/types'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { getContainingView } from '@jbrowse/core/util'
import { supportedIndexingAdapters } from '@jbrowse/text-indexing'
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
import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import SettingsIcon from '@material-ui/icons/Settings'
import CopyIcon from '@material-ui/icons/FileCopy'
import DeleteIcon from '@material-ui/icons/Delete'
import InfoIcon from '@material-ui/icons/Info'
import { Indexing } from '@jbrowse/core/ui/Icons'

const AboutDialog = lazy(() => import('@jbrowse/core/ui/AboutDialog'))

export declare interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

export default function sessionModelFactory(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(), // if not using sessionAssemblies
) {
  const minDrawerWidth = 128
  const sessionModel = types
    .model('JBrowseDesktopSessionModel', {
      name: types.identifier,
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
      connectionInstances: types.array(
        pluginManager.pluggableMstType('connection', 'stateModel'),
      ),
      sessionAssemblies: types.array(assemblyConfigSchemasType),

      minimized: types.optional(types.boolean, false),

      drawerPosition: types.optional(
        types.string,
        localStorage.getItem('drawerPosition') || 'right',
      ),
    })
    .volatile((/* self */) => ({
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
      queueOfDialogs: observable.array([] as [DialogComponentType, any][]),
    }))
    .views(self => ({
      get DialogComponent() {
        if (self.queueOfDialogs.length) {
          const firstInQueue = self.queueOfDialogs[0]
          return firstInQueue && firstInQueue[0]
        }
        return undefined
      },
      get DialogProps() {
        if (self.queueOfDialogs.length) {
          const firstInQueue = self.queueOfDialogs[0]
          return firstInQueue && firstInQueue[1]
        }
        return undefined
      },
      get rpcManager() {
        return getParent(self).jbrowse.rpcManager
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
      get textSearchManager(): TextSearchManager {
        return getParent(self).textSearchManager
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

      get assemblyManager() {
        return getParent(self).assemblyManager
      },
      get version() {
        return getParent(self).version
      },
      renderProps() {
        return { theme: readConfObject(this.configuration, 'theme') }
      },
      get visibleWidget() {
        if (isAlive(self)) {
          // returns most recently added item in active widgets
          return Array.from(self.activeWidgets.values())[
            self.activeWidgets.size - 1
          ]
        }
        return undefined
      },

      get adminMode() {
        return true
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
      setDrawerPosition(arg: string) {
        self.drawerPosition = arg
        localStorage.setItem('drawerPosition', arg)
      },
      queueDialog(
        callback: (doneCallback: () => void) => [DialogComponentType, any],
      ): void {
        const [component, props] = callback(() => {
          self.queueOfDialogs.shift()
        })
        self.queueOfDialogs.push([component, props])
      },
      makeConnection(
        configuration: AnyConfigurationModel,
        initialSnapshot = {},
      ) {
        const { type } = configuration
        if (!type) {
          throw new Error('track configuration has no `type` listed')
        }
        const name = readConfObject(configuration, 'name')
        const connectionType = pluginManager.getConnectionType(type)
        if (!connectionType) {
          throw new Error(`unknown connection type ${type}`)
        }
        const connectionData = {
          ...initialSnapshot,
          name,
          type,
          configuration,
        }
        const length = self.connectionInstances.push(connectionData)
        return self.connectionInstances[length - 1]
      },

      prepareToBreakConnection(configuration: AnyConfigurationModel) {
        const callbacksToDereferenceTrack: Function[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        const name = readConfObject(configuration, 'name')
        const connection = self.connectionInstances.find(c => c.name === name)
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
        const connection = self.connectionInstances.find(c => c.name === name)
        self.connectionInstances.remove(connection)
      },

      deleteConnection(configuration: AnyConfigurationModel) {
        return getParent(self).jbrowse.deleteConnectionConf(configuration)
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
        const oldDrawerWidth = self.drawerWidth
        const newDrawerWidth = this.updateDrawerWidth(oldDrawerWidth - distance)
        const actualDistance = oldDrawerWidth - newDrawerWidth
        return actualDistance
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

      removeView(view: any) {
        for (const [, widget] of self.activeWidgets) {
          if (widget.view && widget.view.id === view.id) {
            this.hideWidget(widget)
          }
        }
        self.views.remove(view)
      },

      addAssembly(assemblyConfig: any) {
        self.sessionAssemblies.push(assemblyConfig)
      },

      addAssemblyConf(assemblyConf: any) {
        return getParent(self).jbrowse.addAssemblyConf(assemblyConf)
      },

      addTrackConf(trackConf: any) {
        return getParent(self).jbrowse.addTrackConf(trackConf)
      },

      hasWidget(widget: any) {
        return self.activeWidgets.has(widget.id)
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
        })
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
        return getParent(self).jbrowse.deleteTrackConf(trackConf)
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
        if (!assembly) {
          throw new Error(
            `Could not add view of assembly "${assemblyName}", assembly name not found`,
          )
        }
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
        if (!typeDefinition) {
          throw new Error(`unknown widget type ${typeName}`)
        }
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
        if (self.activeWidgets.has(widget.id)) {
          self.activeWidgets.delete(widget.id)
        }
        self.activeWidgets.set(widget.id, widget)
      },

      hideWidget(widget: any) {
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
        const editor = this.addWidget(
          'ConfigurationEditorWidget',
          'configEditor',
          { target: configuration },
        )
        this.showWidget(editor)
      },
      editTrackConfiguration(configuration: AnyConfigurationModel) {
        this.editConfiguration(configuration)
      },

      clearConnections() {
        self.connectionInstances.length = 0
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
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent(self).setSession(sessionSnapshot)
      },
    }))

    .views(self => ({
      getTrackActionMenuItems(config: any) {
        const session = self
        const trackSnapshot = JSON.parse(JSON.stringify(getSnapshot(config)))
        return [
          {
            label: 'About track',
            onClick: () => {
              session.queueDialog(doneCallback => [
                AboutDialog,
                { config, handleClose: doneCallback },
              ])
            },
            icon: InfoIcon,
          },
          {
            label: 'Settings',
            onClick: () => session.editConfiguration(config),
            icon: SettingsIcon,
          },
          {
            label: 'Delete track',
            onClick: () => {
              session.deleteTrackConf(config)
            },
            icon: DeleteIcon,
          },
          {
            label: 'Copy track',
            onClick: () => {
              const now = Date.now()
              trackSnapshot.trackId += `-${now}`
              trackSnapshot.displays.forEach((d: { displayId: string }) => {
                d.displayId += `-${now}`
              })
              trackSnapshot.name += ' (copy)'
              trackSnapshot.category = undefined
              session.addTrackConf(trackSnapshot)
            },
            icon: CopyIcon,
          },
          {
            label: trackSnapshot.textSearching
              ? 'Re-index track'
              : 'Index track',
            disabled: !supportedIndexingAdapters(trackSnapshot.adapter.type),
            onClick: () => {
              const rootModel = getParent(self)
              const { jobsManager } = rootModel
              const { trackId, assemblyNames, textSearching, name } =
                trackSnapshot
              const indexName = name + '-index'
              // TODO: open jobs list widget
              jobsManager.queueJob({
                indexingParams: {
                  attributes: textSearching?.indexingAttributes || [
                    'Name',
                    'ID',
                  ],
                  exclude: textSearching?.indexingFeatureTypesToExclude || [
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
                cancelCallback: () => jobsManager.abortJob(),
              })
            },
            icon: Indexing,
          },
        ]
      },
    }))

  return types.snapshotProcessor(addSnackbarToModel(sessionModel), {
    // @ts-ignore
    preProcessor(snapshot) {
      if (snapshot) {
        // @ts-ignore
        const { connectionInstances, ...rest } = snapshot || {}
        // connectionInstances schema changed from object to an array, so any
        // old connectionInstances as object is in snapshot, filter it out
        // https://github.com/GMOD/jbrowse-components/issues/1903
        if (!Array.isArray(connectionInstances)) {
          return rest
        }
      }
      return snapshot
    },
  })
}

export type SessionStateModel = ReturnType<typeof sessionModelFactory>

// a track is a combination of an assembly and a renderer, along with some conditions
// specifying in which contexts it is available (which assemblies, which views, etc)
