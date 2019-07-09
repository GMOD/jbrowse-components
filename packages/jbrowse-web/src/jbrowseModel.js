import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { flow, getSnapshot, resolveIdentifier, types } from 'mobx-state-tree'
import shortid from 'shortid'
import corePlugins from './corePlugins'
import sessionModelFactory from './session/sessionModelFactory'
import RenderWorker from './rpc.worker'
import * as rpcFuncs from './rpcMethods'

const pluginManager = new PluginManager(corePlugins.map(P => new P()))
pluginManager.configure()

const Session = sessionModelFactory(pluginManager)

// poke some things for testing (this stuff will eventually be removed)
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

const JBrowseWeb = types
  .model('JBrowseWeb', {
    sessions: types.map(Session),
    activeSession: types.safeReference(Session),
    errorMessage: '',
    configuration: ConfigurationSchema('Root', {
      rpc: RpcManager.configSchema,
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
            sessionName = `Unnamed Session ${shortid.generate()}`,
          } = defaultSession

          const data = {
            sessionName,
            ...defaultSession,
            configuration: sessionConfig,
          }
          self.sessions.set(sessionName, data)
          if (!self.activeSession) {
            self.activateSession(sessionName)
          }
        } catch (error) {
          console.error('Failed to add session', error)
          self.errorMessage = String(error)
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
        self.errorMessage = String(error)
      }
    }),
    activateSession(name) {
      self.activeSession = name
      // poke some things for testing (this stuff will eventually be removed)
      window.MODEL = self.sessions.get(name)
    },
  }))
  .views(self => ({
    get sessionNames() {
      return Array.from(self.sessions.keys())
    },
  }))
  .volatile(self => ({
    rpcManager: new RpcManager(pluginManager, self.configuration.rpc, {
      WebWorkerRpcDriver: { WorkerClass: RenderWorker },
      MainThreadRpcDriver: { rpcFuncs },
    }),
    // pluginManager,
    // rpcManager,
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
