/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy } from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import {
  readConfObject,
  isConfigurationModel,
  getConf,
} from '@jbrowse/core/configuration'
import { createJBrowseTheme, defaultThemes } from '@jbrowse/core/ui/theme'
import {
  Region,
  TrackViewModel,
  DialogComponentType,
} from '@jbrowse/core/util/types'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import {
  getContainingView,
  localStorageGetItem,
  localStorageSetItem,
} from '@jbrowse/core/util'
import { supportedIndexingAdapters } from '@jbrowse/text-indexing'
import { autorun, observable } from 'mobx'
import {
  addDisposer,
  getMembers,
  getParent,
  getSnapshot,
  getType,
  isAlive,
  isModelType,
  isReferenceType,
  types,
  walk,
  IAnyStateTreeNode,
  SnapshotIn,
} from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'

// icons
import SettingsIcon from '@mui/icons-material/Settings'
import CopyIcon from '@mui/icons-material/FileCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoIcon from '@mui/icons-material/Info'
import { Indexing } from '@jbrowse/core/ui/Icons'
import { ThemeOptions } from '@mui/material'

const AboutDialog = lazy(() => import('@jbrowse/core/ui/AboutDialog'))

export declare interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

type ThemeMap = { [key: string]: ThemeOptions }

/**
 * #stateModel JBrowseDesktopSessionModel
 * inherits SnackbarModel
 */
export default function sessionModelFactory(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  const minDrawerWidth = 128
  const sessionModel = types
    .model('JBrowseDesktopSessionModel', {
      /**
       * #property
       */
      name: types.identifier,
      /**
       * #property
       */
      margin: 0,
      /**
       * #property
       */
      drawerWidth: types.optional(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      ),
      /**
       * #property
       */
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
      /**
       * #property
       */
      widgets: types.map(
        pluginManager.pluggableMstType('widget', 'stateModel'),
      ),
      /**
       * #property
       */
      activeWidgets: types.map(
        types.safeReference(
          pluginManager.pluggableMstType('widget', 'stateModel'),
        ),
      ),
      /**
       * #property
       */
      connectionInstances: types.array(
        pluginManager.pluggableMstType('connection', 'stateModel'),
      ),
      /**
       * #property
       */
      sessionAssemblies: types.array(assemblyConfigSchemasType),
      /**
       * #property
       */
      temporaryAssemblies: types.array(assemblyConfigSchemasType),

      /**
       * #property
       */
      minimized: types.optional(types.boolean, false),

      /**
       * #property
       */
      drawerPosition: types.optional(
        types.string,
        () => localStorageGetItem('drawerPosition') || 'right',
      ),
    })
    .volatile((/* self */) => ({
      sessionThemeName: localStorageGetItem('themeName') || 'default',
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
      /**
       * #getter
       */
      get jbrowse() {
        return getParent<any>(self).jbrowse
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      allThemes(): ThemeMap {
        const extraThemes = getConf(self.jbrowse, 'extraThemes')
        return { ...defaultThemes, ...extraThemes }
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get themeName() {
        const { sessionThemeName } = self
        const all = self.allThemes()
        return all[sessionThemeName] ? sessionThemeName : 'default'
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get theme() {
        const configTheme = getConf(self.jbrowse, 'theme')
        const all = self.allThemes()
        return createJBrowseTheme(configTheme, all, self.themeName)
      },

      /**
       * #getter
       */
      get DialogComponent() {
        if (self.queueOfDialogs.length) {
          const firstInQueue = self.queueOfDialogs[0]
          return firstInQueue && firstInQueue[0]
        }
        return undefined
      },
      /**
       * #getter
       */
      get DialogProps() {
        if (self.queueOfDialogs.length) {
          const firstInQueue = self.queueOfDialogs[0]
          return firstInQueue && firstInQueue[1]
        }
        return undefined
      },
      /**
       * #getter
       */
      get rpcManager() {
        return getParent<any>(self).jbrowse.rpcManager
      },
      /**
       * #getter
       */
      get configuration(): AnyConfigurationModel {
        return getParent<any>(self).jbrowse.configuration
      },
      /**
       * #getter
       */
      get assemblies(): AnyConfigurationModel[] {
        return getParent<any>(self).jbrowse.assemblies
      },
      /**
       * #getter
       */
      get assemblyNames(): string[] {
        return getParent<any>(self).jbrowse.assemblyNames
      },
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return getParent<any>(self).jbrowse.tracks
      },
      /**
       * #getter
       */
      get textSearchManager(): TextSearchManager {
        return getParent<any>(self).textSearchManager
      },
      /**
       * #getter
       */
      get connections() {
        return getParent<any>(self).jbrowse.connections
      },
      /**
       * #getter
       */
      get savedSessions() {
        return getParent<any>(self).jbrowse.savedSessions
      },
      /**
       * #getter
       */
      get savedSessionNames() {
        return getParent<any>(self).jbrowse.savedSessionNames
      },
      /**
       * #getter
       */
      get history() {
        return getParent<any>(self).history
      },
      /**
       * #getter
       */
      get menus() {
        return getParent<any>(self).menus
      },

      /**
       * #getter
       */
      get assemblyManager() {
        return getParent<any>(self).assemblyManager
      },
      /**
       * #getter
       */
      get version() {
        return getParent<any>(self).version
      },
      /**
       * #method
       */
      renderProps() {
        return { theme: readConfObject(this.configuration, 'theme') }
      },
      /**
       * #getter
       */
      get visibleWidget() {
        if (isAlive(self)) {
          // returns most recently added item in active widgets
          return [...self.activeWidgets.values()][self.activeWidgets.size - 1]
        }
        return undefined
      },

      /**
       * #getter
       */
      get adminMode() {
        return true
      },
      /**
       * #method
       * See if any MST nodes currently have a types.reference to this object.
       *
       * @param object - object
       *
       * @returns An array where the first element is the node referring to the
       * object and the second element is they property name the node is using to
       * refer to the object
       */
      getReferring(object: IAnyStateTreeNode) {
        const refs: ReferringNode[] = []
        walk(getParent<any>(self), node => {
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
      /**
       * #action
       */
      setThemeName(name: string) {
        self.sessionThemeName = name
      },
      /**
       * #action
       */
      moveViewUp(id: string) {
        const idx = self.views.findIndex(v => v.id === id)

        if (idx === -1) {
          return
        }
        if (idx > 0) {
          self.views.splice(idx - 1, 2, self.views[idx], self.views[idx - 1])
        }
      },
      /**
       * #action
       */
      moveViewDown(id: string) {
        const idx = self.views.findIndex(v => v.id === id)

        if (idx === -1) {
          return
        }

        if (idx < self.views.length - 1) {
          self.views.splice(idx, 2, self.views[idx + 1], self.views[idx])
        }
      },

      /**
       * #action
       */
      setDrawerPosition(arg: string) {
        self.drawerPosition = arg
        localStorage.setItem('drawerPosition', arg)
      },

      /**
       * #action
       */
      queueDialog(
        callback: (doneCallback: () => void) => [DialogComponentType, any],
      ): void {
        const [component, props] = callback(() => {
          self.queueOfDialogs.shift()
        })
        self.queueOfDialogs.push([component, props])
      },

      /**
       * #action
       */
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

      /**
       * #action
       */
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

      /**
       * #action
       */
      breakConnection(configuration: AnyConfigurationModel) {
        const name = readConfObject(configuration, 'name')
        const connection = self.connectionInstances.find(c => c.name === name)
        self.connectionInstances.remove(connection)
      },

      /**
       * #action
       */
      deleteConnection(configuration: AnyConfigurationModel) {
        return getParent<any>(self).jbrowse.deleteConnectionConf(configuration)
      },

      /**
       * #action
       */
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

      /**
       * #action
       */
      resizeDrawer(distance: number) {
        const oldDrawerWidth = self.drawerWidth
        const newDrawerWidth = this.updateDrawerWidth(oldDrawerWidth - distance)
        const actualDistance = oldDrawerWidth - newDrawerWidth
        return actualDistance
      },

      /**
       * #action
       */
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

      /**
       * #action
       */
      removeView(view: any) {
        for (const [, widget] of self.activeWidgets) {
          if (widget.view && widget.view.id === view.id) {
            this.hideWidget(widget)
          }
        }
        self.views.remove(view)
      },

      /**
       * #action
       */
      addAssembly(assemblyConfig: any) {
        self.sessionAssemblies.push(assemblyConfig)
      },

      /**
       * #action
       */
      removeAssembly(assemblyName: string) {
        const index = self.sessionAssemblies.findIndex(
          asm => asm.name === assemblyName,
        )
        if (index !== -1) {
          self.sessionAssemblies.splice(index, 1)
        }
      },

      /**
       * #action
       */
      removeTemporaryAssembly(assemblyName: string) {
        const index = self.temporaryAssemblies.findIndex(
          asm => asm.name === assemblyName,
        )
        if (index !== -1) {
          self.temporaryAssemblies.splice(index, 1)
        }
      },

      /**
       * #action
       * used for read vs ref type assemblies
       */
      addTemporaryAssembly(assemblyConfig: AnyConfigurationModel) {
        const asm = self.sessionAssemblies.find(
          f => f.name === assemblyConfig.name,
        )
        if (asm) {
          console.warn(`Assembly ${assemblyConfig.name} was already existing`)
          return asm
        }
        const length = self.temporaryAssemblies.push(assemblyConfig)
        return self.temporaryAssemblies[length - 1]
      },

      /**
       * #action
       */
      addAssemblyConf(assemblyConf: any) {
        return getParent<any>(self).jbrowse.addAssemblyConf(assemblyConf)
      },

      /**
       * #action
       */
      addTrackConf(trackConf: any) {
        return getParent<any>(self).jbrowse.addTrackConf(trackConf)
      },

      /**
       * #action
       */
      hasWidget(widget: any) {
        return self.activeWidgets.has(widget.id)
      },

      /**
       * #action
       */
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
       * #action
       */
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
        return getParent<any>(self).jbrowse.deleteTrackConf(trackConf)
      },

      /**
       * #action
       */
      addConnectionConf(connectionConf: any) {
        return getParent<any>(self).jbrowse.addConnectionConf(connectionConf)
      },

      /**
       * #action
       */
      addLinearGenomeViewOfAssembly(assemblyName: string, initialState = {}) {
        return this.addViewOfAssembly(
          'LinearGenomeView',
          assemblyName,
          initialState,
        )
      },

      /**
       * #action
       */
      addViewOfAssembly(
        viewType: any,
        assemblyName: string,
        initialState: any = {},
      ) {
        const asm = self.assemblies.find(
          s => readConfObject(s, 'name') === assemblyName,
        )
        if (!asm) {
          throw new Error(
            `Could not add view of assembly "${assemblyName}", assembly name not found`,
          )
        }
        return this.addView(viewType, {
          ...initialState,
          displayRegionsFromAssemblyName: readConfObject(asm, 'name'),
        })
      },

      /**
       * #action
       */
      addViewFromAnotherView(
        viewType: string,
        otherView: any,
        initialState: { displayedRegions?: Region[] } = {},
      ) {
        const state = { ...initialState }
        state.displayedRegions = getSnapshot(otherView.displayedRegions)
        return this.addView(viewType, state)
      },

      /**
       * #action
       */
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

      /**
       * #action
       */
      showWidget(widget: any) {
        if (self.activeWidgets.has(widget.id)) {
          self.activeWidgets.delete(widget.id)
        }
        self.activeWidgets.set(widget.id, widget)
      },

      /**
       * #action
       */
      hideWidget(widget: any) {
        self.activeWidgets.delete(widget.id)
      },

      /**
       * #action
       */
      minimizeWidgetDrawer() {
        self.minimized = true
      },

      /**
       * #action
       */
      showWidgetDrawer() {
        self.minimized = false
      },

      /**
       * #action
       */
      hideAllWidgets() {
        self.activeWidgets.clear()
      },

      /**
       * #action
       * set the global selection, i.e. the globally-selected object.
       * can be a feature, a view, just about anything
       * @param thing -
       */
      setSelection(thing: any) {
        self.selection = thing
      },

      /**
       * #action
       * clears the global selection
       */
      clearSelection() {
        self.selection = undefined
      },

      /**
       * #action
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

      /**
       * #action
       */
      editTrackConfiguration(configuration: AnyConfigurationModel) {
        this.editConfiguration(configuration)
      },

      /**
       * #action
       */
      clearConnections() {
        self.connectionInstances.length = 0
      },

      /**
       * #action
       */
      addSavedSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent<any>(self).jbrowse.addSavedSession(sessionSnapshot)
      },

      /**
       * #action
       */
      removeSavedSession(sessionSnapshot: any) {
        return getParent<any>(self).jbrowse.removeSavedSession(sessionSnapshot)
      },

      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        return getParent<any>(self).renameCurrentSession(sessionName)
      },

      /**
       * #action
       */
      duplicateCurrentSession() {
        return getParent<any>(self).duplicateCurrentSession()
      },

      /**
       * #action
       */
      activateSession(sessionName: any) {
        return getParent<any>(self).activateSession(sessionName)
      },

      /**
       * #action
       */
      setDefaultSession() {
        return getParent<any>(self).setDefaultSession()
      },

      /**
       * #action
       */
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent<any>(self).setSession(sessionSnapshot)
      },
    }))

    .views(self => ({
      /**
       * #method
       */
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
              const rootModel = getParent<any>(self)
              const { jobsManager } = rootModel
              const { trackId, assemblyNames, textSearching, name } =
                trackSnapshot
              const indexName = `${name}-index`
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
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            localStorageSetItem('drawerPosition', self.drawerPosition)
            localStorageSetItem('themeName', self.themeName)
          }),
        )
      },
    }))

  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as typeof sessionModel

  return types.snapshotProcessor(addSnackbarToModel(extendedSessionModel), {
    // @ts-expect-error
    preProcessor(snapshot) {
      if (snapshot) {
        // @ts-expect-error
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
