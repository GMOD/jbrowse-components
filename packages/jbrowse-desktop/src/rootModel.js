import { getSnapshot, types } from 'mobx-state-tree'
import { UndoManager } from 'mst-middlewares'
import JBrowseWeb, { Session } from './jbrowseModel'

const { electronBetterIpc = {} } = window
const { ipcRenderer } = electronBetterIpc

const RootModel = types
  .model('Root', {
    jbrowse: JBrowseWeb,
    session: types.maybe(Session),
    savedSessionNames: types.maybe(types.array(types.string)),
  })
  .volatile((/* self */) => ({
    history: {},
  }))
  .actions(self => ({
    setSavedSessionNames(sessionNames) {
      self.savedSessionNames = sessionNames
    },
    setSession(sessionSnapshot) {
      self.session = sessionSnapshot
    },
    setDefaultSession() {
      this.setSession({
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
      this.setSession(snapshot)
      ipcRenderer.invoke('renameSession', oldName, sessionName)
    },
    duplicateCurrentSession() {
      const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
      let newSnapshotName = `${self.session.name} (copy)`
      if (self.jbrowse.savedSessionNames.includes(newSnapshotName)) {
        let newSnapshotCopyNumber = 2
        do {
          newSnapshotName = `${self.session.name} (copy ${newSnapshotCopyNumber})`
          newSnapshotCopyNumber += 1
        } while (self.jbrowse.savedSessionNames.includes(newSnapshotName))
      }
      snapshot.name = newSnapshotName
      this.setSession(snapshot)
    },
    activateSession(sessionSnapshot) {
      this.setSession(sessionSnapshot)
      if (sessionSnapshot)
        this.setHistory(UndoManager.create({}, { targetStore: self.session }))
      else this.setHistory(undefined)
    },
    setHistory(history) {
      self.history = history
    },
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
