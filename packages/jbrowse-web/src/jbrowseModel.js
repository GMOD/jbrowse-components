import {
  ConfigurationSchema,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'
import { getSnapshot, resolveIdentifier, types } from 'mobx-state-tree'
import { UndoManager } from 'mst-middlewares'
import AssemblyConfigSchemasFactory from './assemblyConfigSchemas'
import corePlugins from './corePlugins'
import RenderWorker from './rpc.worker'
import * as rpcFuncs from './rpcMethods'
import sessionModelFactory from './sessionModelFactory'

const pluginManager = new PluginManager(corePlugins.map(P => new P()))
pluginManager.configure()

const Session = sessionModelFactory(pluginManager)
const { assemblyConfigSchemas, dispatcher } = AssemblyConfigSchemasFactory(
  pluginManager,
)

const Dataset = ConfigurationSchema(
  'Dataset',
  {
    name: {
      type: 'string',
      defaultValue: '',
      description: 'Name of the dataset',
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
    }),
  },
)

// poke some things for testing (this stuff will eventually be removed)
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

const JBrowseWeb = types
  .model('JBrowseWeb', {
    session: types.maybe(Session),
    defaultSession: types.optional(types.frozen(Session), {
      name: `New Session ${new Date(Date.now()).toISOString()}`,
      menuBars: [{ type: 'MainMenuBar' }],
    }),
    savedSessions: types.array(types.frozen(Session)),
    datasets: types.array(Dataset),
    history: types.optional(UndoManager, { targetPath: '../session' }),
    configuration: ConfigurationSchema('Root', {
      rpc: RpcManager.configSchema,
      // possibly consider this for global config editor
      highResolutionScaling: {
        type: 'number',
        defaultValue: 2,
      },
      updateUrl: {
        type: 'boolean',
        defaultValue: true,
      },
    }),
  })
  .actions(self => ({
    addSavedSession(sessionSnapshot) {
      const length = self.savedSessions.push(sessionSnapshot)
      return self.savedSessions[length - 1]
    },
    removeSavedSession(sessionSnapshot) {
      self.savedSessions.remove(sessionSnapshot)
    },
    setSession(snapshot) {
      self.session = snapshot
    },
    setDefaultSession() {
      self.setSession(self.defaultSession)
    },
    renameCurrentSession(sessionName) {
      const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
      snapshot.name = sessionName
      this.setSession(snapshot)
    },
    duplicateCurrentSession() {
      const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
      snapshot.name = `${self.session.name} (copy)`
      this.setSession(snapshot)
    },
    activateSession(name) {
      const newSessionSnapshot = self.savedSessions.find(
        sessionSnap => sessionSnap.name === name,
      )
      if (!newSessionSnapshot)
        throw new Error(
          `Can't activate session ${name}, it is not in the savedSessions`,
        )
      self.setSession(newSessionSnapshot)
    },
    addDataset(datasetConf) {
      const length = self.datasets.push(datasetConf)
      return self.datasets[length - 1]
    },
  }))
  .views(self => ({
    get savedSessionNames() {
      return self.savedSessions.map(sessionSnap => sessionSnap.name)
    },
  }))
  // Grouping the "assembly manager" stuff under an `extend` just for
  // code organization
  .extend(self => ({
    views: {
      get assemblyData() {
        const assemblyData = new Map()
        for (const datasetConfig of self.datasets) {
          const assemblyConfig = datasetConfig.assembly
          const assemblyName = readConfObject(assemblyConfig, 'name')
          const assemblyInfo = {}
          if (assemblyConfig.sequence)
            assemblyInfo.sequence = assemblyConfig.sequence
          const refNameAliasesConf = readConfObject(
            assemblyConfig,
            'refNameAliases',
          )
          if (refNameAliasesConf)
            assemblyInfo.refNameAliases = refNameAliasesConf
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
                assemblyData.get(assemblyName).sequence =
                  connectionConf.sequence
                assemblyData.get(assemblyName).aliases.forEach(alias => {
                  assemblyData.get(alias).sequence = connectionConf.sequence
                })
              }
            }
          })
        }
        return assemblyData
      },
    },
    actions: {
      getRefNameAliases(assemblyName, opts = {}) {
        return Promise.resolve({}).then(refNameAliases => {
          const assemblyConfig = self.assemblyData.get(assemblyName)
          if (assemblyConfig.refNameAliases) {
            return self.rpcManager
              .call(
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
              .then(adapterRefNameAliases => {
                adapterRefNameAliases.forEach(alias => {
                  refNameAliases[alias.refName] = alias.aliases
                })
                return refNameAliases
              })
          }
          return refNameAliases
        })
      },

      addRefNameMapForAdapter(adapterConf, assemblyName, opts = {}) {
        return self
          .getRefNameAliases(assemblyName, opts)
          .then(refNameAliases => {
            const adapterConfigId = readConfObject(adapterConf, 'configId')
            if (!self.refNameMaps.has(adapterConfigId))
              self.refNameMaps.set(adapterConfigId, new Map())
            const refNameMap = self.refNameMaps.get(adapterConfigId)

            return self.rpcManager
              .call(
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
              .then(refNames => {
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
              })
          })
      },

      getRefNameMapForAdapter(adapterConf, assemblyName, opts = {}) {
        const configId = readConfObject(adapterConf, 'configId')
        if (!self.refNameMaps.has(configId))
          return self.addRefNameMapForAdapter(adapterConf, assemblyName, opts)
        return Promise.resolve(self.refNameMaps.get(configId))
      },
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

export function createTestSession(snapshot = {}) {
  const jbrowseState = JBrowseWeb.create({
    configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
  })
  jbrowseState.setSession({
    name: 'testSession',
    menuBars: [{ type: 'MainMenuBar' }],
    ...snapshot,
  })
  return jbrowseState.session
}

export default JBrowseWeb
