import { detach, getRoot, getType, types, flow } from 'mobx-state-tree'
import {
  ConfigurationSchema,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'
import {
  convertTrackConfig,
  createRefSeqsAdapter,
  fetchJb1,
} from './connections/jb1Hub'
import AssemblyConfigsSchemasFactory from './assemblyConfigSchemas'

export default function(pluginManager) {
  const { assemblyConfigSchemas, dispatcher } = AssemblyConfigsSchemasFactory(
    pluginManager,
  )
  return ConfigurationSchema(
    'JBrowseWebRoot',
    {
      // A map of assembly name -> assembly details
      assemblies: types.array(
        types.union({ dispatcher }, ...assemblyConfigSchemas),
      ),

      highResolutionScaling: 2, // possibly consider this for global config editor

      connections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),

      rpc: RpcManager.configSchema,

      defaultSession: {
        type: 'frozen',
        defaultValue: null,
        description: 'Snapshot representing a default session',
      },
    },
    {
      actions: self => ({
        addConnection(connectionConf) {
          const connectionType = readConfObject(
            connectionConf,
            'connectionType',
          )
          if (!['trackHub', 'jbrowse1'].includes(connectionType))
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
          if (connectionType === 'jbrowse1') self.fetchJBrowse1(connectionConf)
        },

        removeConnection(connectionConf) {
          self.volatile.delete(connectionConf.connectionName)
          self.connections.remove(connectionConf)
        },

        fetchJBrowse1: flow(function* fetchJBrowse1(connectionConf) {
          const opts = readConfObject(connectionConf, 'connectionOptions') || {}
          const hubLocation = readConfObject(
            connectionConf,
            'connectionLocation',
          )
          // const configs = yield fetchConfigFile({
          //   uri: '/test_data/tracks.conf',
          // })
          const config = yield fetchJb1(hubLocation)
          const adapter = yield createRefSeqsAdapter(config.refSeqs)
          const connectionName = readConfObject(
            connectionConf,
            'connectionName',
          )
          self.addAssembly(
            opts.assemblyName || `assembly from ${connectionName}`,
            undefined,
            undefined,
            {
              type: 'ReferenceSequence',
              adapter,
            },
            connectionName,
          )
          config.tracks.forEach(track => {
            const jb2Track = convertTrackConfig(track, config.dataRoot)
            self.addTrackConf(
              jb2Track.type,
              jb2Track,
              readConfObject(connectionConf, 'connectionName'),
            )
          })
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
