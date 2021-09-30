import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import {
  getParent,
  getRoot,
  getSnapshot,
  resolveIdentifier,
  types,
  cast,
} from 'mobx-state-tree'
import { toJS } from 'mobx'
import { SessionStateModel } from './sessionModelFactory'
import {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration/configurationSchema'
import clone from 'clone'

// poke some things for testing (this stuff will eventually be removed)
// @ts-ignore
window.getSnapshot = getSnapshot
// @ts-ignore
window.resolveIdentifier = resolveIdentifier

export default function JBrowseWeb(
  pluginManager: PluginManager,
  Session: SessionStateModel,
  assemblyConfigSchemasType: AnyConfigurationSchemaType,
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
        logoPath: {
          type: 'fileLocation',
          defaultValue: { uri: '' },
        },
        ...pluginManager.pluginConfigurationSchemas(),
      }),
      plugins: types.array(types.frozen<Plugin>()),
      assemblies: types.array(assemblyConfigSchemasType),
      // track configuration is an array of track config schemas. multiple
      // instances of a track can exist that use the same configuration
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
      aggregateTextSearchAdapters: types.array(
        pluginManager.pluggableConfigSchemaType('text search adapter'),
      ),
      connections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),
      defaultSession: types.optional(types.frozen(Session), {
        name: `New session`,
      }),
    })

    .views(self => ({
      get assemblyNames() {
        return self.assemblies.map(assembly => readConfObject(assembly, 'name'))
      },
      get rpcManager() {
        return getParent(self).rpcManager
      },
    }))
    .actions(self => ({
      afterCreate() {
        const seen = [] as string[]
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
      addAssemblyConf(assemblyConf: AnyConfigurationModel) {
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
      removeAssemblyConf(assemblyName: string) {
        const toRemove = self.assemblies.find(
          assembly => assembly.name === assemblyName,
        )
        if (toRemove) {
          self.assemblies.remove(toRemove)
        }
      },
      addTrackConf(trackConf: AnyConfigurationModel) {
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
      addDisplayConf(trackId: string, displayConf: AnyConfigurationModel) {
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
      addConnectionConf(connectionConf: AnyConfigurationModel) {
        const { type } = connectionConf
        if (!type) {
          throw new Error(`unknown connection type ${type}`)
        }
        const length = self.connections.push(connectionConf)
        return self.connections[length - 1]
      },

      deleteConnectionConf(configuration: AnyConfigurationModel) {
        const idx = self.connections.findIndex(
          conn => conn.id === configuration.id,
        )
        if (idx === -1) {
          return undefined
        }
        return self.connections.splice(idx, 1)
      },

      deleteTrackConf(trackConf: AnyConfigurationModel) {
        const { trackId } = trackConf
        const idx = self.tracks.findIndex(t => t.trackId === trackId)
        if (idx === -1) {
          return undefined
        }

        return self.tracks.splice(idx, 1)
      },
      setDefaultSessionConf(sessionConf: AnyConfigurationModel) {
        let newDefault
        if (getParent(self).session.name === sessionConf.name) {
          newDefault = getSnapshot(sessionConf)
        } else {
          newDefault = toJS(sessionConf)
        }

        if (!newDefault.name) {
          throw new Error(`unable to set default session to ${newDefault.name}`)
        }

        // @ts-ignore complains about name missing, but above line checks this
        self.defaultSession = cast(newDefault)
      },
      addPlugin(plugin: Plugin) {
        self.plugins = cast([...self.plugins, plugin])
        const rootModel = getRoot(self)
        rootModel.setPluginsUpdated(true)
      },
      removePlugin(pluginUrl: string) {
        self.plugins = cast(
          self.plugins.filter(plugin => plugin.url !== pluginUrl),
        )
        const rootModel = getRoot(self)
        rootModel.setPluginsUpdated(true)
      },
    }))

  return types.snapshotProcessor(JBrowseModel, {
    postProcessor(snapshot) {
      function removeAttr(obj: Record<string, unknown>, attr: string) {
        for (const prop in obj) {
          if (prop === attr) {
            delete obj[prop]
          } else if (typeof obj[prop] === 'object') {
            removeAttr(obj[prop] as Record<string, unknown>, attr)
          }
        }
        return obj
      }
      return removeAttr(clone(snapshot), 'baseUri')
    },
  })
}
