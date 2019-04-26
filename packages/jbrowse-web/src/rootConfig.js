import { detach, getRoot, getType, types, flow } from 'mobx-state-tree'
import { ConfigurationSchema, readConfObject } from './configuration'
import RpcManager from './rpc/RpcManager'
import {
  fetchGenomesFile,
  fetchHubFile,
  fetchTrackDbFile,
  generateTracks,
  ucscAssemblies,
} from './connections/ucscHub'

export function assemblyFactory(pluginManager) {
  return ConfigurationSchema('Assembly', {
    sequence: pluginManager.pluggableConfigSchemaType('track'),
    aliases: {
      type: 'stringArray',
      defaultValue: [],
      description: 'Other possible names for this assembly',
    },
    refNameAliases: ConfigurationSchema('RefNameAliases', {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
    }),
  })
}

export default function(pluginManager) {
  const Assemblies = assemblyFactory(pluginManager)
  return ConfigurationSchema(
    'JBrowseWebRoot',
    {
      // track configuration is an array of track config schemas. multiple instances of
      // a track can exist that use the same configuration
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),

      // A map of assembly name -> assembly details
      assemblies: types.map(Assemblies),
      highResolutionScaling: 2, // possibly consider this for global config editor

      connections: types.array(
        ConfigurationSchema(
          'connection',
          {
            connectionName: {
              type: 'string',
              defaultValue: '',
            },
            connectionType: {
              type: 'string',
              defaultValue: 'trackHub',
            },
            connectionLocation: {
              type: 'fileLocation',
              defaultValue: { uri: '/path/to/hub.txt' },
            },
            connectionOptions: {
              type: 'frozen',
              defaultValue: {},
            },
          },
          { explicitlyTyped: true },
        ),
      ),

      rpc: RpcManager.configSchema,

      defaultSession: {
        type: 'frozen',
        defaultValue: null,
        description: 'Snapshot representing a default session',
      },

      volatile: types.map(
        ConfigurationSchema('volatile', {
          tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
          assemblies: types.map(Assemblies),
        }),
      ),
    },
    {
      actions: self => ({
        afterAttach() {
          self.connections.forEach(connectionConf => {
            const connectionType = readConfObject(
              connectionConf,
              'connectionType',
            )
            if (!['trackHub'].includes(connectionType))
              throw new Error(
                `Cannot add connection, unsupported connection type: ${connectionType}`,
              )
            self.configureConnection(connectionConf)
          })
        },

        addTrackConf(typeName, data, connectionName) {
          const type = getRoot(self).pluginManager.getTrackType(typeName)
          if (!type) throw new Error(`unknown track type ${typeName}`)
          const schemaType = type.configSchema
          const conf = schemaType.create(
            Object.assign({ type: typeName }, data),
          )
          if (connectionName) {
            const connectionNames = self.connections.map(connection =>
              readConfObject(connection, 'connectionName'),
            )
            if (!connectionNames.includes(connectionName))
              throw new Error(
                `Cannot add track to non-existent connection: ${connectionName}`,
              )
            self.volatile.get(connectionName).tracks.push(conf)
          } else self.tracks.push(conf)
          return conf
        },

        addConnection(connectionConf) {
          const connectionType = readConfObject(
            connectionConf,
            'connectionType',
          )
          if (!['trackHub'].includes(connectionType))
            throw new Error(
              `Cannot add connection, unsupported connection type: ${connectionType}`,
            )
          const connectionNames = self.connections.map(connection =>
            readConfObject(connection, 'connectionName'),
          )
          const connectionName = readConfObject(
            connectionConf,
            'connectionName',
          )
          if (connectionNames.includes(connectionName))
            throw new Error(
              `Cannot add connection, connection name already exists: ${connectionName}`,
            )
          self.connections.push(connectionConf)
          self.configureConnection(connectionConf)
        },

        configureConnection(connectionConf) {
          const connectionName = readConfObject(
            connectionConf,
            'connectionName',
          )
          const connectionType = readConfObject(
            connectionConf,
            'connectionType',
          )
          self.volatile.set(connectionName, {
            configId: connectionName,
          })
          if (connectionType === 'trackHub') self.fetchUcsc(connectionConf)
        },

        removeConnection(connectionConf) {
          self.volatile.delete(connectionConf.connectionName)
          self.connections.remove(connectionConf)
        },

        fetchUcsc: flow(function* fetchUcsc(connectionConf) {
          const opts = readConfObject(connectionConf, 'connectionOptions') || {}
          const hubFileLocation = readConfObject(
            connectionConf,
            'connectionLocation',
          )
          const hubFile = yield fetchHubFile(hubFileLocation)
          let genomesFileLocation
          if (hubFileLocation.uri)
            genomesFileLocation = {
              uri: new URL(hubFile.get('genomesFile'), hubFileLocation.uri),
            }
          else genomesFileLocation = { localPath: hubFile.get('genomesFile') }
          const genomesFile = yield fetchGenomesFile(genomesFileLocation)
          const assemblyNames = opts.assemblyNames || genomesFile.keys()
          for (const assemblyName of assemblyNames) {
            const twoBitPath = genomesFile.get(assemblyName).get('twoBitPath')
            if (twoBitPath) {
              let twoBitLocation
              if (hubFileLocation.uri)
                twoBitLocation = {
                  uri: new URL(
                    twoBitPath,
                    new URL(hubFile.get('genomesFile'), hubFileLocation.uri),
                  ).href,
                }
              else
                twoBitLocation = {
                  localPath: twoBitPath,
                }
              self.addAssembly(
                assemblyName,
                undefined,
                undefined,
                {
                  type: 'ReferenceSequence',
                  adapter: {
                    type: 'TwoBitAdapter',
                    twoBitLocation,
                  },
                },
                readConfObject(connectionConf, 'connectionName'),
              )
            } else if (ucscAssemblies.includes(assemblyName))
              self.addAssembly(
                assemblyName,
                undefined,
                undefined,
                {
                  type: 'ReferenceSequence',
                  adapter: {
                    type: 'TwoBitAdapter',
                    twoBitLocation: {
                      uri: `http://hgdownload.soe.ucsc.edu/goldenPath/${assemblyName}/bigZips/${assemblyName}.2bit`,
                    },
                  },
                },
                readConfObject(connectionConf, 'connectionName'),
              )
            let trackDbFileLocation
            if (hubFileLocation.uri)
              trackDbFileLocation = {
                uri: new URL(
                  genomesFile.get(assemblyName).get('trackDb'),
                  new URL(hubFile.get('genomesFile'), hubFileLocation.uri),
                ).href,
              }
            else
              trackDbFileLocation = {
                localPath: genomesFile.get(assemblyName).get('trackDb'),
              }
            const trackDbFile = yield fetchTrackDbFile(trackDbFileLocation)
            const tracks = generateTracks(
              trackDbFile,
              trackDbFileLocation,
              assemblyName,
            )
            tracks.forEach(track =>
              self.addTrackConf(
                track.type,
                track,
                readConfObject(connectionConf, 'connectionName'),
              ),
            )
          }
          self.updateAssemblyManager()
        }),

        updateAssemblyManager() {
          const rootModel = getRoot(self)
          rootModel.assemblyManager.updateAssemblyConfigs(
            rootModel.configuration,
          )
        },

        addAssembly(
          assemblyName,
          aliases = [],
          refNameAliases = {
            adapter: {
              type: 'FromConfigAdapter',
              refNameAliases: [],
            },
          },
          sequence = {
            type: 'ReferenceSequence',
            adapter: {
              type: 'FromConfigAdapter',
              regions: [],
            },
          },
          connectionName,
        ) {
          const assemblyModel = getType(self.assemblies).subType.type
          const assembly = assemblyModel.create({
            configId: assemblyName,
            aliases,
            refNameAliases,
            sequence,
          })
          if (connectionName) {
            const connectionNames = self.connections.map(connection =>
              readConfObject(connection, 'connectionName'),
            )
            if (!connectionNames.includes(connectionName))
              throw new Error(
                `Cannot add assembly to non-existent connection: ${connectionName}`,
              )
            self.volatile
              .get(connectionName)
              .assemblies.set(assemblyName, assembly)
          } else self.assemblies.set(assemblyName, assembly)
        },

        removeAssembly(assemblyName) {
          detach(self.assemblies.get(assemblyName))
          self.assemblies.delete(assemblyName)
        },
      }),
    },
  )
}
