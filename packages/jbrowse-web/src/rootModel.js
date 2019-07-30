import { getSnapshot, types } from 'mobx-state-tree'
import { UndoManager } from 'mst-middlewares'
import JBrowseWeb, { Session } from './jbrowseModel'

const RootModel = types
  .model('Root', {
    jbrowse: JBrowseWeb,
    session: types.maybe(Session),
  })
  .actions(self => ({
    setSession(sessionSnapshot) {
      self.session = sessionSnapshot
      self.jbrowse.updateSavedSession(sessionSnapshot)
    },
    setDefaultSession() {
      self.setSession({
        ...self.jbrowse.defaultSession,
        name: `${self.jbrowse.defaultSession.name} ${new Date(
          Date.now(),
        ).toISOString()}`,
      })
    },
    renameCurrentSession(sessionName) {
      const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
      const oldName = snapshot.name
      snapshot.name = sessionName
      self.setSession(snapshot)
      self.jbrowse.replaceSavedSession(oldName, snapshot)
    },
    duplicateCurrentSession() {
      const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
      snapshot.name = `${self.session.name} (copy)`
      self.setSession(snapshot)
    },
    activateSession(name) {
      const newSessionSnapshot = self.jbrowse.savedSessions.find(
        sessionSnap => sessionSnap.name === name,
      )
      if (!newSessionSnapshot)
        throw new Error(
          `Can't activate session ${name}, it is not in the savedSessions`,
        )
      self.setSession(newSessionSnapshot)
    },
    setHistory(history) {
      self.history = history
    },
  }))
  .volatile((/* self */) => ({
    history: {},
  }))

export function createTestSession(snapshot = {}) {
  const root = RootModel.create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  root.setSession({
    name: 'testSession',
    menuBars: [{ type: 'MainMenuBar' }],
    ...snapshot,
  })
  root.setHistory(UndoManager.create({}, { targetStore: root.session }))
  return root.session
}

export default RootModel
