import { detach, getRoot, getType, types, flow } from 'mobx-state-tree'
import { ConfigurationSchema, readConfObject } from './configuration'
import RpcManager from './rpc/RpcManager'
import {
  fetchGenomesFile,
  fetchHubFile,
  fetchTrackDbFile,
  generateTracks,
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
  return ConfigurationSchema(
    'JBrowseWebRoot',
    {
      // track configuration is an array of track config schemas. multiple instances of
      // a track can exist that use the same configuration
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),

      // A map of assembly name -> assembly details
      assemblies: types.map(assemblyFactory(pluginManager)),

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
        }),
      ),
    },
    {
      actions: self => ({
        // afterAttach() {
        //   self.addConnection({
        //     connectionName: 'volvoxHub',
        //     connectionType: 'trackHub',
        //     connectionLocation: {
        //       uri: 'https://jbrowse.org/volvoxhub/hub.txt',
        //     },
        //   })
        // },

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
          const { connectionType } = connectionConf
          if (!['trackHub'].includes(connectionType))
            throw new Error(
              `Cannot add connection, unsupported connection type: ${connectionType}`,
            )
          const connectionNames = self.connections.map(connection =>
            readConfObject(connection, 'connectionName'),
          )
          const { connectionName } = connectionConf
          if (connectionNames.includes(connectionName))
            throw new Error(
              `Cannot add connection, connection name already exists: ${connectionName}`,
            )
          self.volatile.set(connectionName, {
            configId: connectionName,
            tracks: [],
          })
          self.connections.push(connectionConf)
          self.fetchUcsc(connectionConf)
        },

        removeConnection(connectionConf) {
          self.volatile.delete(connectionConf.connectionName)
          self.connections.remove(connectionConf)
        },

        fetchUcsc: flow(function* fetchUcsc(connectionConf) {
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
          for (const genomeName of genomesFile.keys()) {
            let trackDbFileLocation
            if (hubFileLocation.uri)
              trackDbFileLocation = {
                uri: new URL(
                  genomesFile.get(genomeName).get('trackDb'),
                  new URL(hubFile.get('genomesFile'), hubFileLocation.uri),
                ),
              }
            else
              trackDbFileLocation = {
                localPath: genomesFile.get(genomeName).get('trackDb'),
              }
            const trackDbFile = yield fetchTrackDbFile(trackDbFileLocation)
            const tracks = generateTracks(trackDbFile, trackDbFileLocation)
            tracks.forEach(track =>
              self.addTrackConf(
                track.type,
                track,
                readConfObject(connectionConf, 'connectionName'),
              ),
            )
          }
        }),

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
            configId: 'iTo6LoXUeJ',
            type: 'ReferenceSequence',
            adapter: {
              configId: 'Zd0NLmtxPZ3',
              type: 'FromConfigAdapter',
              regions: [],
            },
          },
        ) {
          const assemblyModel = getType(self.assemblies).subType.type
          const assembly = assemblyModel.create({
            configId: assemblyName,
            aliases,
            refNameAliases,
            sequence,
          })
          self.assemblies.set(assemblyName, assembly)
        },

        removeAssembly(assemblyName) {
          detach(self.assemblies.get(assemblyName))
          self.assemblies.delete(assemblyName)
        },
      }),
    },
  )
}
