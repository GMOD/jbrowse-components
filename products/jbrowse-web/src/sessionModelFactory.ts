/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy } from 'react'
import clone from 'clone'
import shortid from 'shortid'
import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import {
  readConfObject,
  getConf,
  isConfigurationModel,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import {
  Region,
  AbstractSessionModel,
  TrackViewModel,
  JBrowsePlugin,
} from '@jbrowse/core/util/types'
import {
  extendSessionModel,
  addAssembly,
  removeAssembly,
  addSessionTrack,
} from '@jbrowse/app-core'

import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { getContainingView } from '@jbrowse/core/util'
import {
  getMembers,
  getParent,
  getRoot,
  getSnapshot,
  getType,
  isAlive,
  isModelType,
  isReferenceType,
  types,
  walk,
  cast,
  IAnyStateTreeNode,
  Instance,
  SnapshotIn,
  SnapshotOut,
} from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

// icons
import SettingsIcon from '@mui/icons-material/Settings'
import CopyIcon from '@mui/icons-material/FileCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoIcon from '@mui/icons-material/Info'
import { addSessionAssembly } from '@jbrowse/app-core/src/sessionModel'

const AboutDialog = lazy(() => import('@jbrowse/core/ui/AboutDialog'))

export declare interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

export declare interface ReactProps {
  [key: string]: any
}

type AnyConfiguration =
  | AnyConfigurationModel
  | SnapshotOut<AnyConfigurationModel>

export default function sessionModelFactory(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  const minDrawerWidth = 128
  const sessionModel = extendSessionModel(
    types.model('JBrowseWebSessionModel', {
      id: types.optional(types.identifier, shortid()),
      name: types.string,
      margin: 0,
      drawerWidth: types.optional(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      ),
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
      sessionConnections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),
      sessionAssemblies: types.array(assemblyConfigSchemasType),
      temporaryAssemblies: types.array(assemblyConfigSchemasType),
      sessionPlugins: types.array(types.frozen()),
      minimized: types.optional(types.boolean, false),

      drawerPosition: types.optional(
        types.string,
        localStorage.getItem('drawerPosition') || 'right',
      ),
    }),
    pluginManager,
  )
    .views(self => ({
      get shareURL() {
        return getConf(getParent<any>(self).jbrowse, 'shareURL')
      },
      get rpcManager() {
        return getParent<any>(self).jbrowse.rpcManager as RpcManager
      },
      get configuration(): AnyConfigurationModel {
        return getParent<any>(self).jbrowse.configuration
      },
      get assemblies(): AnyConfigurationModel[] {
        return getParent<any>(self).jbrowse.assemblies
      },
      get assemblyNames(): string[] {
        const { assemblyNames } = getParent<any>(self).jbrowse
        const sessionAssemblyNames = self.sessionAssemblies.map(assembly =>
          readConfObject(assembly, 'name'),
        )
        return [...assemblyNames, ...sessionAssemblyNames]
      },
      get tracks(): AnyConfigurationModel[] {
        return [...self.sessionTracks, ...getParent<any>(self).jbrowse.tracks]
      },
      get textSearchManager(): TextSearchManager {
        return getParent<any>(self).textSearchManager
      },
      get connections(): AnyConfigurationModel[] {
        return [
          ...self.sessionConnections,
          ...getParent<any>(self).jbrowse.connections,
        ]
      },
      get adminMode(): boolean {
        return getParent<any>(self).adminMode
      },
      get savedSessions() {
        return getParent<any>(self).savedSessions
      },
      get previousAutosaveId() {
        return getParent<any>(self).previousAutosaveId
      },
      get savedSessionNames() {
        return getParent<any>(self).savedSessionNames
      },
      get history() {
        return getParent<any>(self).history
      },
      get menus() {
        return getParent<any>(self).menus
      },
      get assemblyManager() {
        return getParent<any>(self).assemblyManager
      },
      get version() {
        return getParent<any>(self).version
      },

      renderProps() {
        return { theme: getConf(self, 'theme') }
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
      setDrawerPosition(arg: string) {
        self.drawerPosition = arg
        localStorage.setItem('drawerPosition', arg)
      },

      setName(str: string) {
        self.name = str
      },

      addAssembly(conf: AnyConfiguration) {
        return addAssembly(self, self.sessionAssemblies, conf)
      },
      addTemporaryAssembly(conf: AnyConfiguration) {
        return addAssembly(self, self.temporaryAssemblies, conf)
      },
      addSessionPlugin(plugin: JBrowsePlugin) {
        if (self.sessionPlugins.find(p => p.name === plugin.name)) {
          throw new Error('session plugin cannot be installed twice')
        }
        self.sessionPlugins.push(plugin)
        getRoot<any>(self).setPluginsUpdated(true)
      },
      removeAssembly(assemblyName: string) {
        return removeAssembly(self, self.sessionAssemblies, assemblyName)
      },
      removeTemporaryAssembly(assemblyName: string) {
        return removeAssembly(self, self.temporaryAssemblies, assemblyName)
      },
      removeSessionPlugin(pluginDefinition: PluginDefinition) {
        self.sessionPlugins = cast(
          self.sessionPlugins.filter(
            plugin =>
              plugin.url !== pluginDefinition.url ||
              plugin.umdUrl !== pluginDefinition.umdUrl ||
              plugin.cjsUrl !== pluginDefinition.cjsUrl ||
              plugin.esmUrl !== pluginDefinition.esmUrl,
          ),
        )
        const rootModel = getParent<any>(self)
        rootModel.setPluginsUpdated(true)
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
        let deletedConn
        if (self.adminMode) {
          deletedConn =
            getParent<any>(self).jbrowse.deleteConnectionConf(configuration)
        }
        if (!deletedConn) {
          const { connectionId } = configuration
          const idx = self.sessionConnections.findIndex(
            c => c.connectionId === connectionId,
          )
          if (idx === -1) {
            return undefined
          }
          return self.sessionConnections.splice(idx, 1)
        }
        return deletedConn
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

      addAssemblyConf(assemblyConf: AnyConfiguration) {
        return getParent<any>(self).jbrowse.addAssemblyConf(assemblyConf)
      },

      addTrackConf(trackConf: AnyConfiguration) {
        if (self.adminMode) {
          return getParent<any>(self).jbrowse.addTrackConf(trackConf)
        } else {
          return addSessionTrack(self, trackConf)
        }
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
          return getParent<any>(self).jbrowse.deleteTrackConf(trackConf)
        }
        const { trackId } = trackConf
        const idx = self.sessionTracks.findIndex(t => t.trackId === trackId)
        if (idx === -1) {
          return undefined
        }
        return self.sessionTracks.splice(idx, 1)
      },

      addConnectionConf(connectionConf: any) {
        if (self.adminMode) {
          return getParent<any>(self).jbrowse.addConnectionConf(connectionConf)
        }
        const { connectionId, type } = connectionConf
        if (!type) {
          throw new Error(`unknown connection type ${type}`)
        }
        const connection = self.sessionConnections.find(
          (c: any) => c.connectionId === connectionId,
        )
        if (connection) {
          return connection
        }
        const length = self.sessionConnections.push(connectionConf)
        return self.sessionConnections[length - 1]
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
          s => readConfObject(s, 'name') === assemblyName,
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

      minimizeWidgetDrawer() {
        self.minimized = true
      },
      showWidgetDrawer() {
        self.minimized = false
      },

      addSavedSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent<any>(self).addSavedSession(sessionSnapshot)
      },

      removeSavedSession(sessionSnapshot: any) {
        return getParent<any>(self).removeSavedSession(sessionSnapshot)
      },

      renameCurrentSession(sessionName: string) {
        return getParent<any>(self).renameCurrentSession(sessionName)
      },

      duplicateCurrentSession() {
        return getParent<any>(self).duplicateCurrentSession()
      },
      activateSession(sessionName: any) {
        return getParent<any>(self).activateSession(sessionName)
      },
      setDefaultSession() {
        return getParent<any>(self).setDefaultSession()
      },
      saveSessionToLocalStorage() {
        return getParent<any>(self).saveSessionToLocalStorage()
      },
      loadAutosaveSession() {
        return getParent<any>(self).loadAutosaveSession()
      },
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent<any>(self).setSession(sessionSnapshot)
      },
    }))

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
        const { adminMode, sessionTracks } = self
        if (!adminMode && sessionTracks.indexOf(configuration) === -1) {
          throw new Error("Can't edit the configuration of a non-session track")
        }
        this.editConfiguration(configuration)
      },
    }))
    .views(self => ({
      getTrackActionMenuItems(config: AnyConfigurationModel) {
        const { adminMode, sessionTracks } = self
        const canEdit =
          adminMode || sessionTracks.find(t => t.trackId === config.trackId)

        // disable if it is a reference sequence track
        const isRefSeq =
          readConfObject(config, 'type') === 'ReferenceSequenceTrack'
        return [
          {
            label: 'About track',
            onClick: () => {
              self.queueDialog(handleClose => [
                AboutDialog,
                { config, handleClose },
              ])
            },
            icon: InfoIcon,
          },
          {
            label: 'Settings',
            disabled: !canEdit,
            onClick: () => self.editTrackConfiguration(config),
            icon: SettingsIcon,
          },
          {
            label: 'Delete track',
            disabled: !canEdit || isRefSeq,
            onClick: () => self.deleteTrackConf(config),
            icon: DeleteIcon,
          },
          {
            label: 'Copy track',
            disabled: isRefSeq,
            onClick: () => {
              const snap = clone(getSnapshot(config)) as any
              const now = Date.now()
              snap.trackId += `-${now}`
              snap.displays.forEach((display: { displayId: string }) => {
                display.displayId += `-${now}`
              })
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
        ]
      },
    }))

  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as typeof sessionModel

  return types.snapshotProcessor(addSnackbarToModel(extendedSessionModel), {
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
export type SessionModel = Instance<SessionStateModel>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<SessionStateModel>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
