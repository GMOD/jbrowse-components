import clone from 'clone'
import { autorun } from 'mobx'
import { addDisposer, getSnapshot, types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseSession, BaseRootModel } from '@jbrowse/product-core'
import type { SnapshotIn } from 'mobx-state-tree'

const { ipcRenderer } = window.require('electron')

export function getSaveSession(model: BaseRootModel) {
  const snap = getSnapshot(model.jbrowse)
  return {
    ...(snap as Record<string, unknown>),
    defaultSession: model.session ? getSnapshot(model.session) : {},
  }
}

/**
 * #stateModel DesktopSessionManagementMixin
 * #category root
 */
export function DesktopSessionManagementMixin(_pluginManager: PluginManager) {
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
      const self = s as typeof s & BaseRootModel
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
          if (!self.session) {
            return
          }
          const snapshot = clone(getSnapshot(self.session))
          let newSnapshotName = `${self.session.name} (copy)`
          if (self.jbrowse.savedSessionNames.includes(newSnapshotName)) {
            let newSnapshotCopyNumber = 2
            do {
              newSnapshotName = `${self.session.name} (copy ${newSnapshotCopyNumber})`
              newSnapshotCopyNumber += 1
            } while (self.jbrowse.savedSessionNames.includes(newSnapshotName))
          }
          self.setSession({
            ...(snapshot as Record<string, unknown>),
            name: newSnapshotName,
          })
        },
        /**
         * #action
         */
        activateSession(sessionSnapshot: SnapshotIn<BaseSession>) {
          self.setSession(sessionSnapshot)
        },
      }
    })
    .actions(s => {
      const self = s as typeof s & BaseRootModel
      return {
        afterCreate() {
          addDisposer(
            self,
            autorun(
              async () => {
                if (!self.session) {
                  return
                }
                try {
                  await self.saveSession(getSaveSession(self))
                } catch (e) {
                  console.error(e)
                }
              },
              { delay: 1000 },
            ),
          )
        },
      }
    })
}

export type SessionManagerType = ReturnType<
  typeof DesktopSessionManagementMixin
>
