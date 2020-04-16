import { getSnapshot, types } from 'mobx-state-tree'
import { UndoManager } from 'mst-middlewares'
import JBrowseDesktop from './jbrowseModel'
import sessionModelFactory from './sessionModelFactory'

const { electronBetterIpc = {} } = window
const { ipcRenderer } = electronBetterIpc

export default function RootModel(pluginManager) {
  const Session = sessionModelFactory(pluginManager)
  return types
    .model('Root', {
      jbrowse: JBrowseDesktop(pluginManager, Session),
      session: types.maybe(Session),
      savedSessionNames: types.maybe(types.array(types.string)),
    })
    .actions(self => ({
      setSavedSessionNames(sessionNames) {
        self.savedSessionNames = sessionNames
      },
      setSession(sessionSnapshot) {
        self.session = sessionSnapshot
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
        self.setSession(snapshot)
      },
      activateSession(sessionSnapshot) {
        self.setSession(sessionSnapshot)
        if (sessionSnapshot)
          self.setHistory(UndoManager.create({}, { targetStore: self.session }))
        else self.setHistory(undefined)
      },
      setHistory(history) {
        self.history = history
      },
    }))
    .volatile((/* self */) => ({
      history: {},
    }))
}
