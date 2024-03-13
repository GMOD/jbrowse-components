import React, { lazy } from 'react'
import { types } from 'mobx-state-tree'
import { observable } from 'mobx'

// locals
import { NotificationLevel, SnackAction } from '../util/types'

// icons
import Report from '@mui/icons-material/Report'

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
      snackbarMessages: observable.array<SnackbarMessage>(),
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
        return self.snackbarMessages.push({ message, level, action })
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
        const element = self.snackbarMessages.find(f => f.message === message)
        if (element) {
          self.snackbarMessages.remove(element)
        }
      },
    }))
}
