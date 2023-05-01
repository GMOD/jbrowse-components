import PluginManager from '@jbrowse/core/PluginManager'
import { BaseRootModelType } from '@jbrowse/product-core'
import { autorun } from 'mobx'
import {
  Instance,
  SnapshotIn,
  addDisposer,
  getSnapshot,
  types,
} from 'mobx-state-tree'
import { BaseSessionModel } from '../sessionModel/Base'

const { ipcRenderer } = window.require('electron')

export function getSaveSession(model: Instance<BaseRootModelType>) {
  return {
    ...getSnapshot(model.jbrowse),
    defaultSession: model.session ? getSnapshot(model.session) : {},
  }
}

export default function SessionManagement(pluginManager: PluginManager) {
  return types
    .model({
      /**
       * #property
       */
      savedSessionNames: types.maybe(types.array(types.string)),
      /**
       * #property
       */
      sessionPath: types.optional(types.string, ''),
    })
    .actions(s => {
      const self = s as typeof s & Instance<BaseRootModelType>
      return {
        /**
         * #action
         */
        async saveSession(val: unknown) {
          if (self.sessionPath) {
            await ipcRenderer.invoke('saveSession', self.sessionPath, val)
          }
        },
        /**
         * #action
         */
        duplicateCurrentSession() {
          if (self.session) {
            const snapshot = JSON.parse(
              JSON.stringify(getSnapshot(self.session)),
            )
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
          }
        },
        /**
         * #action
         */
        activateSession(sessionSnapshot: SnapshotIn<BaseSessionModel>) {
          self.setSession(sessionSnapshot)
        },
      }
    })
    .actions(s => {
      const self = s as typeof s & Instance<BaseRootModelType>
      return {
        afterCreate() {
          addDisposer(
            self,
            autorun(
              async () => {
                if (self.session) {
                  try {
                    await self.saveSession(
                      getSaveSession(self as Instance<BaseRootModelType>),
                    )
                  } catch (e) {
                    console.error(e)
                  }
                }
              },
              { delay: 1000 },
            ),
          )
        },
      }
    })
}

export type SessionManagerType = ReturnType<typeof SessionManagement>
