/* eslint-disable @typescript-eslint/no-explicit-any */
// note: AboutDialog is imported statically instead of as a lazy component
// due to vite failing to load it xref #2896
import {
  AbstractSessionModel,
  TrackViewModel,
  DialogComponentType,
} from '@jbrowse/core/util/types'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { getContainingView } from '@jbrowse/core/util'
import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { version } from '../version'
import {
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
  Instance,
  IAnyStateTreeNode,
} from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import InfoIcon from '@mui/icons-material/Info'
import AboutDialog from '@jbrowse/core/ui/AboutDialog'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { ReferringNode } from '../types'

/**
 * #stateModel JBrowseReactLGVSessionModel
 * inherits SnackbarModel
 */
export default function sessionModelFactory(pluginManager: PluginManager) {
  const model = types
    .model('ReactLinearGenomeViewSession', {
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
      view: pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel,
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
      sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
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
      /**
       * #getter
       */
      get disableAddTracks() {
        return getParent<any>(self).disableAddTracks
      },
      /**
       * #getter
       */
      get DialogComponent() {
        if (self.queueOfDialogs.length) {
          return self.queueOfDialogs[0]?.[0]
        }
        return undefined
      },
      /**
       * #getter
       */
      get DialogProps() {
        if (self.queueOfDialogs.length) {
          return self.queueOfDialogs[0]?.[1]
        }
        return undefined
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
      get rpcManager() {
        return getParent<any>(self).rpcManager
      },
      /**
       * #getter
       */
      get configuration() {
        return getParent<any>(self).config.configuration
      },
      /**
       * #getter
       */
      get assemblies() {
        return [getParent<any>(self).config.assembly]
      },
      /**
       * #getter
       */
      get assemblyNames() {
        return [getParent<any>(self).config.assemblyName]
      },
      /**
       * #getter
       */
      get tracks() {
        return getParent<any>(self).config.tracks
      },
      /**
       * #getter
       */
      get aggregateTextSearchAdapters() {
        return getParent<any>(self).config.aggregateTextSearchAdapters
      },
      /**
       * #getter
       */
      get connections() {
        return getParent<any>(self).config.connections
      },
      /**
       * #getter
       */
      get adminMode() {
        return false
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
        return version
      },
      /**
       * #getter
       */
      get views() {
        return [self.view]
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
       * #method
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
      /**
       * #action
       */
      addTrackConf(trackConf: AnyConfigurationModel) {
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
      /**
       * #action
       */
      queueDialog(
        callback: (doneCallback: () => void) => [DialogComponentType, any],
      ): void {
        const [component, props] = callback(() => {
          this.removeActiveDialog()
        })
        self.queueOfDialogs = [...self.queueOfDialogs, [component, props]]
      },
      /**
       * #action
       */
      removeActiveDialog() {
        self.queueOfDialogs = self.queueOfDialogs.slice(1)
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

      /**
       * #action
       */
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
      hasWidget(widget: any) {
        return self.activeWidgets.has(widget.id)
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
       */
      clearConnections() {
        self.connectionInstances.length = 0
      },
      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        return getParent<any>(self).renameCurrentSession(sessionName)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
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
