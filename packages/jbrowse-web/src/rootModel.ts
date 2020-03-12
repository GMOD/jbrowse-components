import { getSnapshot, types, cast, SnapshotIn } from 'mobx-state-tree'
import { UndoManager } from 'mst-middlewares'
import { AbstractSessionModel } from '@gmod/jbrowse-core/util'
import JBrowseWeb, { Session } from './jbrowseModel'

const RootModel = types
  .model('Root', {
    jbrowse: JBrowseWeb,
    session: types.maybe(Session),
  })
  .actions(self => ({
    setSession(sessionSnapshot: SnapshotIn<typeof Session>) {
      self.session = cast(sessionSnapshot)
      self.jbrowse.updateSavedSession(sessionSnapshot)
    },
    setDefaultSession() {
      this.setSession({
        ...self.jbrowse.defaultSession,
        name: `${self.jbrowse.defaultSession.name} ${new Date(
          Date.now(),
        ).toISOString()}`,
      })
    },
    renameCurrentSession(sessionName: string) {
      if (self.session) {
        const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
        const oldName = snapshot.name
        snapshot.name = sessionName
        self.jbrowse.replaceSavedSession(oldName, snapshot)
        this.setSession(snapshot)
      }
    },
    duplicateCurrentSession() {
      if (self.session) {
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
      }
    },
    activateSession(name: string) {
      const newSessionSnapshot = self.jbrowse.savedSessions.find(
        sessionSnap => sessionSnap.name === name,
      )
      if (!newSessionSnapshot)
        throw new Error(
          `Can't activate session ${name}, it is not in the savedSessions`,
        )
      this.setSession(newSessionSnapshot)
    },
  }))
  .volatile((/* self */) => ({
    history: {},
  }))
  .actions(self => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setHistory(history: any) {
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
  return root.session as AbstractSessionModel
}

export default RootModel
