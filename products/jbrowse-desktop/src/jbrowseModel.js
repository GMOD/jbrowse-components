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
        featureDetails: ConfigurationSchema('FeatureDetails', {
          sequenceTypes: {
            type: 'stringArray',
            defaultValue: ['mRNA', 'transcript'],
          },
        }),
        disableAnalytics: {
          type: 'boolean',
          defaultValue: false,
        },
        theme: { type: 'frozen', defaultValue: {} },
        logoPath: {
          type: 'fileLocation',
          defaultValue: { uri: '' },
        },
        ...pluginManager.pluginConfigurationSchemas(),
      }),
      plugins: types.array(types.frozen()),
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
        if (!name) {
          throw new Error('Can\'t add assembly with no "name"')
        }
        if (self.assemblyNames.includes(name)) {
          throw new Error(
            `Can't add assembly with name "${name}", an assembly with that name already exists`,
          )
        }
        const length = self.assemblies.push({
          ...assemblyConf,
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: `${name}-${Date.now()}`,
            ...(assemblyConf.sequence || {}),
          },
        })
        return self.assemblies[length - 1]
      },
      removeAssemblyConf(assemblyName) {
        const toRemove = self.assemblies.find(
          assembly => assembly.name === assemblyName,
        )
        if (toRemove) {
          self.assemblies.remove(toRemove)
        }
      },
      addTrackConf(trackConf) {
        const { type } = trackConf
        if (!type) {
          throw new Error(`unknown track type ${type}`)
        }
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      addConnectionConf(connectionConf) {
        const { type } = connectionConf
        if (!type) {
          throw new Error(`unknown connection type ${type}`)
        }
        const length = self.connections.push(connectionConf)
        return self.connections[length - 1]
      },
      deleteConnectionConf(configuration) {
        const idx = self.connections.findIndex(
          conn => conn.id === configuration.id,
        )
        return self.connections.splice(idx, 1)
      },
      deleteTrackConf(trackConf) {
        const { trackId } = trackConf
        const idx = self.tracks.findIndex(t => t.trackId === trackId)
        if (idx === -1) {
          return undefined
        }

        return self.tracks.splice(idx, 1)
      },
      addPlugin(plugin) {
        self.plugins = [...self.plugins, plugin]
        const rootModel = getParent(self)
        rootModel.setPluginsUpdated(true)
      },
      removePlugin(pluginName) {
        self.plugins = self.plugins.filter(
          plugin => `${plugin.name}Plugin` !== pluginName,
        )
        const rootModel = getParent(self)
        rootModel.setPluginsUpdated(true)
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
