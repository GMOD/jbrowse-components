import {
  ConfigurationSchema,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'
import { getSession } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { flow, getSnapshot, resolveIdentifier, types } from 'mobx-state-tree'
import shortid from 'shortid'
import corePlugins from './corePlugins'
import RenderWorker from './rpc.worker'
import * as rpcFuncs from './rpcMethods'
import AssemblyConfigSchemasFactory from './session/assemblyConfigSchemas'
import sessionModelFactory from './session/sessionModelFactory'

const pluginManager = new PluginManager(corePlugins.map(P => new P()))
pluginManager.configure()

const Session = sessionModelFactory(pluginManager)
const { assemblyConfigSchemas, dispatcher } = AssemblyConfigSchemasFactory(
  pluginManager,
)

const Species = ConfigurationSchema(
  'Species',
  {
    name: {
      type: 'string',
      defaultValue: '',
      description: 'Name of the species',
    },
    assembly: types.union({ dispatcher }, ...assemblyConfigSchemas),
    // track configuration is an array of track config schemas. multiple
    // instances of a track can exist that use the same configuration
    tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
    connections: types.array(
      pluginManager.pluggableConfigSchemaType('connection'),
    ),
  },
  {
    actions: self => ({
      addTrackConf(typeName, data, connectionName) {
        const type = getSession(self).pluginManager.getTrackType(typeName)
        if (!type) throw new Error(`unknown track type ${typeName}`)
        const schemaType = type.configSchema
        const conf = schemaType.create(Object.assign({ type: typeName }, data))
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
      addConnectionConf(typeName, data) {
        const type = getSession(self).pluginManager.getConnectionType(typeName)
        if (!type) throw new Error(`unknown connection type ${typeName}`)
        const schemaType = type.configSchema
        const conf = schemaType.create(Object.assign({ type: typeName }, data))
        self.connections.push(conf)
        return conf
      },
    }),
  },
)

// poke some things for testing (this stuff will eventually be removed)
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

const JBrowseWeb = types
  .model('JBrowseWeb', {
    session: types.maybe(Session),
    sessionSnapshots: types.array(types.frozen(Session)),
    species: types.array(Species),
    configuration: ConfigurationSchema('Root', {
      rpc: RpcManager.configSchema,
      // possibly consider this for global config editor
      highResolutionScaling: {
        type: 'number',
        defaultValue: 2,
      },
    }),
  })
  .actions(self => ({
    addSession(sessionConfig) {
      if (sessionConfig.uri || sessionConfig.localPath)
        self.addSessionFromLocation(sessionConfig)
      else
        try {
          let { defaultSession } = sessionConfig
          if (!defaultSession) defaultSession = {}
          if (!defaultSession.menuBars)
            defaultSession.menuBars = [{ type: 'MainMenuBar' }]
          const {
            name = `Unnamed Session ${shortid.generate()}`,
          } = defaultSession

          const data = {
            name,
            ...defaultSession,
            configuration: sessionConfig,
          }
          self.sessions.set(name, data)
          if (!self.session) {
            self.activateSession(name)
          }
        } catch (error) {
          console.error('Failed to add session', error)
        }
    },
    addSessionFromLocation: flow(function* addSessionFromLocation(
      sessionConfigLocation,
    ) {
      try {
        const configSnapshot = JSON.parse(
          yield openLocation(sessionConfigLocation).readFile('utf8'),
        )
        self.addSession(configSnapshot)
      } catch (error) {
        console.error('Failed to fetch config', error)
      }
    }),
    setSession(snapshot) {
      self.session = snapshot
    },
    setEmptySession() {
      self.setSession({
        name: `Unnamed Session ${shortid.generate()}`,
        menuBars: [{ type: 'MainMenuBar' }],
      })
    },
    activateSession(name) {
      const newSessionSnapshot = self.sessionSnapshots.find(
        sessionSnap => sessionSnap.name === name,
      )
      if (!newSessionSnapshot)
        throw new Error(
          `Can't activate session ${name}, it is not in the sessionSnapshots`,
        )
      self.setSession(newSessionSnapshot)
    },

    getRefNameAliases: flow(function* getRefNameAliases(
      assemblyName,
      opts = {},
    ) {
      const refNameAliases = {}
      const assemblyConfig = self.assemblyData.get(assemblyName)
      if (assemblyConfig.refNameAliases) {
        const adapterRefNameAliases = yield self.rpcManager.call(
          assemblyConfig.refNameAliases.adapter.configId,
          'getRefNameAliases',
          {
            sessionId: assemblyName,
            adapterType: assemblyConfig.refNameAliases.adapter.type,
            adapterConfig: assemblyConfig.refNameAliases.adapter,
            signal: opts.signal,
          },
          { timeout: 1000000 },
        )
        adapterRefNameAliases.forEach(alias => {
          refNameAliases[alias.refName] = alias.aliases
        })
      }
      return refNameAliases
    }),

    addRefNameMapForAdapter: flow(function* addRefNameMapForAdapter(
      adapterConf,
      assemblyName,
      opts = {},
    ) {
      const adapterConfigId = readConfObject(adapterConf, 'configId')
      if (!self.refNameMaps.has(adapterConfigId))
        self.refNameMaps.set(adapterConfigId, new Map())
      const refNameMap = self.refNameMaps.get(adapterConfigId)

      const refNameAliases = yield self.getRefNameAliases(assemblyName, opts)

      const refNames = yield self.rpcManager.call(
        readConfObject(adapterConf, 'configId'),
        'getRefNames',
        {
          sessionId: assemblyName,
          adapterType: readConfObject(adapterConf, 'type'),
          adapterConfig: adapterConf,
          signal: opts.signal,
        },
        { timeout: 1000000 },
      )
      refNames.forEach(refName => {
        if (refNameAliases[refName])
          refNameAliases[refName].forEach(refNameAlias => {
            refNameMap.set(refNameAlias, refName)
          })
        else
          Object.keys(refNameAliases).forEach(configRefName => {
            if (refNameAliases[configRefName].includes(refName)) {
              refNameMap.set(configRefName, refName)
              refNameAliases[configRefName].forEach(refNameAlias => {
                if (refNameAlias !== refName)
                  refNameMap.set(refNameAlias, refName)
              })
            }
          })
      })
      return refNameMap
    }),

    getRefNameMapForAdapter: flow(function* getRefNameMapForAdapter(
      adapterConf,
      assemblyName,
      opts = {},
    ) {
      const configId = readConfObject(adapterConf, 'configId')
      if (!self.refNameMaps.has(configId)) {
        return yield self.addRefNameMapForAdapter(
          adapterConf,
          assemblyName,
          opts,
        )
      }
      return self.refNameMaps.get(configId)
    }),
  }))
  .views(self => ({
    get sessionNames() {
      return self.sessionSnapshots.map(sessionSnap => sessionSnap.name)
    },

    get assemblyData() {
      const assemblyData = new Map()
      for (const speciesConfig of self.species) {
        const assemblyConfig = speciesConfig.assembly
        const assemblyName = readConfObject(assemblyConfig, 'name')
        const assemblyInfo = {}
        if (assemblyConfig.sequence)
          assemblyInfo.sequence = assemblyConfig.sequence
        const refNameAliasesConf = readConfObject(
          assemblyConfig,
          'refNameAliases',
        )
        if (refNameAliasesConf) assemblyInfo.refNameAliases = refNameAliasesConf
        const aliases = readConfObject(assemblyConfig, 'aliases')
        assemblyInfo.aliases = aliases
        assemblyData.set(assemblyName, assemblyInfo)
        aliases.forEach((assemblyAlias, idx) => {
          const newAliases = [
            ...aliases.slice(0, idx),
            ...aliases.slice(idx + 1),
            assemblyName,
          ]
          assemblyData.set(assemblyAlias, {
            ...assemblyInfo,
            aliases: newAliases,
          })
        })
      }
      for (const assemblyName of self.session.connections.keys()) {
        const connectionConfs = self.session.connections.get(assemblyName)
        // eslint-disable-next-line no-loop-func
        connectionConfs.forEach(connectionConf => {
          if (!assemblyData.has(assemblyName)) {
            const assemblyInfo = {}
            assemblyInfo.sequence = connectionConf.sequence
            assemblyInfo.refNameAliases = connectionConf.refNameAliases
            assemblyData.set(assemblyName, assemblyInfo)
          } else {
            if (
              !assemblyData.get(assemblyName).refNameAliases &&
              connectionConf.refNameAliases
            ) {
              assemblyData.get(assemblyName).refNameAliases = readConfObject(
                connectionConf.refNameAliases,
              )
              assemblyData.get(assemblyName).aliases.forEach(alias => {
                assemblyData.get(alias).refNameAliases = readConfObject(
                  connectionConf.refNameAliases,
                )
              })
            }
            if (
              (!assemblyData.get(assemblyName).sequence &&
                connectionConf.sequence) ||
              connectionConf.defaultSequence
            ) {
              assemblyData.get(assemblyName).sequence = connectionConf.sequence
              assemblyData.get(assemblyName).aliases.forEach(alias => {
                assemblyData.get(alias).sequence = connectionConf.sequence
              })
            }
          }
        })
      }
      return assemblyData
    },
  }))
  .volatile(self => ({
    rpcManager: new RpcManager(
      pluginManager,
      self.configuration.rpc,
      {
        WebWorkerRpcDriver: { WorkerClass: RenderWorker },
        MainThreadRpcDriver: { rpcFuncs },
      },
      self.getRefNameMapForAdapter,
    ),
    refNameMaps: new Map(),
  }))

export function createTestSession(snapshot = {}, root = false) {
  const jbrowseState = JBrowseWeb.create({
    configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
  })
  jbrowseState.addSession(snapshot)
  if (root) return jbrowseState
  return jbrowseState.activeSession
}

export default JBrowseWeb
