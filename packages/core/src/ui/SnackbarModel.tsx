import { lazy } from 'react'

import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import type { NotificationLevel, SnackAction } from '../util/types/index.ts'

// lazies
const ErrorMessageStackTraceDialog = lazy(
  () => import('./ErrorMessageStackTraceDialog.tsx'),
)

export interface SnackbarMessage {
  message: string
  level?: NotificationLevel
  actions?: SnackAction[]
}

/**
 * #stateModel SnackbarModel
 * #category session
 */
export default function SnackbarModel() {
  return types
    .model({})
    .volatile(() => ({
      /**
       * #volatile
       */
      snackbarMessages: observable.array<SnackbarMessage>(),
    }))
    .views(self => ({
      /**
       * #getter
       */
      get snackbarMessageSet() {
        return new Map(self.snackbarMessages.map(s => [s.message, s]))
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      notify(
        message: string,
        level?: NotificationLevel,
        action?: SnackAction | SnackAction[],
      ) {
        const actions = action
          ? Array.isArray(action)
            ? action
            : [action]
          : undefined
        this.pushSnackbarMessage(message, level, actions)
        if (level === 'info' || level === 'success') {
          setTimeout(() => {
            this.removeSnackbarMessage(message)
          }, 5000)
        }
      },

      /**
       * #action
       */
      notifyError(
        errorMessage: string,
        error?: unknown,
        extra?: unknown,
        action?: SnackAction,
      ) {
        const reportAction: SnackAction = {
          name: 'report',
          onClick: () => {
            // @ts-expect-error
            self.queueDialog((onClose: () => void) => [
              ErrorMessageStackTraceDialog,
              {
                onClose,
                error,
                extra,
              },
            ])
          },
        }
        const actions = action ? [reportAction, action] : [reportAction]
        this.pushSnackbarMessage(errorMessage, 'error', actions)
      },
      /**
       * #action
       */
      pushSnackbarMessage(
        message: string,
        level?: NotificationLevel,
        actions?: SnackAction[],
      ) {
        if (actions?.length || !self.snackbarMessageSet.has(message)) {
          self.snackbarMessages.push({
            message,
            level,
            actions,
          })
        }
      },
      /**
       * #action
       */
      popSnackbarMessage() {
        return self.snackbarMessages.pop()
      },
      /**
       * #action
       */
      removeSnackbarMessage(message: string) {
        const element = self.snackbarMessageSet.get(message)
        if (element !== undefined) {
          self.snackbarMessages.remove(element)
        }
      },
    }))
}
