import React, { lazy } from 'react'
import Report from '@mui/icons-material/Report'
import { observable } from 'mobx'
import { types } from 'mobx-state-tree'

// locals
import type { NotificationLevel, SnackAction } from '../util/types'

// icons

// lazies
const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

export interface SnackbarMessage {
  message: string
  level?: NotificationLevel
  action?: SnackAction
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
      notify(message: string, level?: NotificationLevel, action?: SnackAction) {
        this.pushSnackbarMessage(message, level, action)
        if (level === 'info' || level === 'success') {
          setTimeout(() => {
            this.removeSnackbarMessage(message)
          }, 5000)
        }
      },

      /**
       * #action
       */
      notifyError(errorMessage: string, error?: unknown, extra?: unknown) {
        this.notify(errorMessage, 'error', {
          name: <Report />,
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
        })
      },
      /**
       * #action
       */
      pushSnackbarMessage(
        message: string,
        level?: NotificationLevel,
        action?: SnackAction,
      ) {
        if (action || !self.snackbarMessageSet.has(message)) {
          self.snackbarMessages.push({ message, level, action })
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
