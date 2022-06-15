/* eslint-disable @typescript-eslint/no-explicit-any */
// note: AboutDialog is imported statically instead of as a lazy component
// due to vite failing to load it xref #2896
import {
  AbstractSessionModel,
  TrackViewModel,
  DialogComponentType,
} from '@jbrowse/core/util/types'
import { getContainingView } from '@jbrowse/core/util'
import {
  getMembers,
  getParent,
  getSnapshot,
  getType,
  IAnyStateTreeNode,
  isAlive,
  isModelType,
  isReferenceType,
  types,
  walk,
  Instance,
} from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import InfoIcon from '@mui/icons-material/Info'
import AboutDialog from '@jbrowse/core/ui/AboutDialog'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { ReferringNode } from '../types'

export default function sessionModelFactory(pluginManager: PluginManager) {
  const model = types
    .model('ReactCircularGenomeViewSession', {
      name: types.identifier,
      view: pluginManager.getViewType('CircularView').stateModel,
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

      queueOfDialogs: [] as [DialogComponentType, any][],
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
        return getParent<any>(self).rpcManager
      },
      get configuration() {
        return getParent<any>(self).config.configuration
      },
      get assemblies() {
        return [getParent<any>(self).config.assembly]
      },
      get assemblyNames() {
        return [getParent<any>(self).config.assemblyName]
      },
      get tracks() {
        return getParent<any>(self).config.tracks
      },
      get aggregateTextSearchAdapters() {
        return getParent<any>(self).config.aggregateTextSearchAdapters
      },
      get connections() {
        return getParent<any>(self).config.connections
      },
      get adminMode() {
        return false
      },
      get assemblyManager() {
        return getParent<any>(self).assemblyManager
      },
      get version() {
        return ''
      },
      get views() {
        return [self.view]
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
      queueDialog(
        callback: (doneCallback: () => void) => [DialogComponentType, any],
      ): void {
        const [component, props] = callback(() => {
          this.removeActiveDialog()
        })
        self.queueOfDialogs = [...self.queueOfDialogs, [component, props]]
      },
      removeActiveDialog() {
        self.queueOfDialogs = self.queueOfDialogs.slice(1)
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
          if (this.hasWidget(node)) {
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
      },

      breakConnection(configuration: AnyConfigurationModel) {
        const name = readConfObject(configuration, 'name')
        const connection = self.connectionInstances.find(c => c.name === name)
        self.connectionInstances.remove(connection)
      },

      addView(typeName: string, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown view type ${typeName}`)
        }

        self.view = {
          ...initialState,
          type: typeName,
        }
        return self.view
      },

      removeView() {},

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
        self.connectionInstances.length = 0
      },

      renameCurrentSession(sessionName: string) {
        return getParent<any>(self).renameCurrentSession(sessionName)
      },
    }))
    .views(self => ({
      getTrackActionMenuItems(config: any) {
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

  return addSnackbarToModel(model)
}

export type SessionStateModel = ReturnType<typeof sessionModelFactory>
export type SessionModel = Instance<SessionStateModel>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<SessionStateModel>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
