import { autorun } from 'mobx'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseRootModel, BaseSession } from '@jbrowse/product-core'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

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
