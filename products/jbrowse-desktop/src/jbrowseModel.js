import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  getParent,
  getSnapshot,
  resolveIdentifier,
  types,
  walk,
  getType,
  getMembers,
  isModelType,
  isReferenceType,
} from 'mobx-state-tree'

// poke some things for testing (this stuff will eventually be removed)
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

export default function JBrowseDesktop(
  pluginManager,
  Session,
  assemblyConfigSchemasType,
) {
  return types
    .model('JBrowseDesktop', {
      configuration: ConfigurationSchema('Root', {
        rpc: RpcManager.configSchema,
        // possibly consider this for global config editor
        highResolutionScaling: {
          type: 'number',
          defaultValue: 2,
        },
        useUrlSession: {
          type: 'boolean',
          defaultValue: true,
        },
        useLocalStorage: {
          type: 'boolean',
          defaultValue: false,
        },
      }),
      plugins: types.frozen(),
      assemblies: types.array(assemblyConfigSchemasType),
      // track configuration is an array of track config schemas. multiple
      // instances of a track can exist that use the same configuration
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
      connections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),
      defaultSession: types.optional(types.frozen(Session), {
        name: `New Session`,
      }),
    })
    .actions(self => ({
      afterCreate() {
        const seen = []
        self.assemblyNames.forEach(assemblyName => {
          if (!assemblyName) {
            throw new Error('Encountered an assembly with no "name" defined')
          }
          if (seen.includes(assemblyName)) {
            throw new Error(
              `Found two assemblies with the same name: ${assemblyName}`,
            )
          } else {
            seen.push(assemblyName)
          }
        })
      },
      addSavedSession(sessionSnapshot) {
        const length = self.savedSessions.push(sessionSnapshot)
        return self.savedSessions[length - 1]
      },
      removeSavedSession(sessionSnapshot) {
        self.savedSessions.remove(sessionSnapshot)
      },
      replaceSavedSession(oldName, snapshot) {
        const savedSessionIndex = self.savedSessions.findIndex(
          savedSession => savedSession.name === oldName,
        )
        self.savedSessions[savedSessionIndex] = snapshot
      },
      addAssemblyConf(assemblyConf) {
        const { name } = assemblyConf
        if (!name) throw new Error('Can\'t add assembly with no "name"')
        if (self.assemblyNames.includes(name))
          throw new Error(
            `Can't add assembly with name "${name}", an assembly with that name already exists`,
          )
        const length = self.assemblies.push(assemblyConf)
        return self.assemblies[length - 1]
      },
      addTrackConf(trackConf) {
        const { type } = trackConf
        if (!type) throw new Error(`unknown track type ${type}`)
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      addConnectionConf(connectionConf) {
        const { type } = connectionConf
        if (!type) throw new Error(`unknown connection type ${type}`)
        const length = self.connections.push(connectionConf)
        return self.connections[length - 1]
      },

      hasWidget(widget) {
        return getParent(self).session.activeWidgets.has(widget.id)
      },
      removeReferring(referring, track, callbacks, dereferenceTypeCount) {
        referring.forEach(({ node }) => {
          let dereferenced = false
          try {
            // If a view is referring to the track config, remove the track
            // from the view
            const type = 'open track(s)'
            const view = getContainingView(node)
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
            callbacks.push(() => getParent(self).session.hideWidget(node))
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
      getReferring(object) {
        const refs = []
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
      deleteTrackConf(trackConf) {
        const { trackId } = trackConf
        const idx = self.tracks.findIndex(t => t.trackId === trackId)
        if (idx === -1) {
          return undefined
        }
        const callbacksToDereferenceTrack = []
        const dereferenceTypeCount = {}
        const referring = self.getReferring(trackConf)
        this.removeReferring(
          referring,
          trackConf,
          callbacksToDereferenceTrack,
          dereferenceTypeCount,
        )
        callbacksToDereferenceTrack.forEach(cb => cb())
        return self.tracks.splice(idx, 1)
      },
    }))
    .views(self => ({
      get savedSessionNames() {
        return getParent(self).savedSessionNames
      },
      get assemblyNames() {
        return self.assemblies.map(assembly => readConfObject(assembly, 'name'))
      },
      get rpcManager() {
        return getParent(self).rpcManager
      },
    }))
}
