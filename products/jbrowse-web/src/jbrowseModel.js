import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  getParent,
  getRoot,
  getSnapshot,
  resolveIdentifier,
  types,
} from 'mobx-state-tree'
import { toJS } from 'mobx'

// poke some things for testing (this stuff will eventually be removed)
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

export default function JBrowseWeb(
  pluginManager,
  Session,
  assemblyConfigSchemasType,
) {
  const JBrowseModel = types
    .model('JBrowseWeb', {
      configuration: ConfigurationSchema('Root', {
        rpc: RpcManager.configSchema,
        // possibly consider this for global config editor
        highResolutionScaling: {
          type: 'number',
          defaultValue: 2,
        },
        shareURL: {
          type: 'string',
          defaultValue: 'https://share.jbrowse.org/api/v1/',
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
        name: `New session`,
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
      addAssemblyConf(assemblyConf) {
        const { name } = assemblyConf
        if (!name) {
          throw new Error('Can\'t add assembly with no "name"')
        }
        const assembly = self.assemblies.find(asm => asm.name === name)
        if (assembly) {
          return assembly
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
        const track = self.tracks.find(t => t.trackId === trackConf.trackId)
        if (track) {
          return track
        }
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      addDisplayConf(trackId, displayConf) {
        const { type } = displayConf
        if (!type) {
          throw new Error(`unknown display type ${type}`)
        }
        const track = self.tracks.find(t => t.trackId === trackId)
        if (!track) {
          throw new Error(`could not find track with id ${trackId}`)
        }
        return track.addDisplayConf(displayConf)
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
        if (idx === -1) {
          return undefined
        }
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
      setDefaultSessionConf(sessionConf) {
        let newDefault
        if (getParent(self).session.name === sessionConf.name) {
          newDefault = getSnapshot(sessionConf)
        } else {
          newDefault = toJS(sessionConf)
        }
        const { name } = newDefault
        if (!name) {
          throw new Error(`unable to set default session to ${name}`)
        }
        self.defaultSession = newDefault
      },
      addPlugin(plugin) {
        self.plugins = [...self.plugins, plugin]
        const rootModel = getRoot(self)
        rootModel.setPluginsUpdated(true)
      },
      removePlugin(pluginName) {
        self.plugins = self.plugins.filter(
          plugin => `${plugin.name}Plugin` !== pluginName,
        )
        const rootModel = getRoot(self)
        rootModel.setPluginsUpdated(true)
      },
    }))
    .views(self => ({
      get assemblyNames() {
        return self.assemblies.map(assembly => readConfObject(assembly, 'name'))
      },
      get rpcManager() {
        return getParent(self).rpcManager
      },
    }))

  return types.snapshotProcessor(JBrowseModel, {
    postProcessor(snapshot) {
      function removeAttr(obj, attr) {
        for (const prop in obj) {
          if (prop === attr) {
            delete obj[prop]
          } else if (typeof obj[prop] === 'object') {
            removeAttr(obj[prop])
          }
        }
      }
      removeAttr(snapshot, 'baseUri')
      return snapshot
    },
  })
}
