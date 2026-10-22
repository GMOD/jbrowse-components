import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import type { NotificationLevel, SnackAction } from '../util/types/index.ts'

export interface SnackbarMessage {
  message: string
  level?: NotificationLevel
  actions?: SnackAction[]
}

export interface ErrorDialogState {
  error: unknown
  extra?: unknown
}

/**
 * #stateModel SnackbarModel
 * #category session
 * Adds notifications to a session: the snackbar messages on screen, and the
 * error shown in the stack-trace dialog.
 */
export default function SnackbarModel() {
  return types
    .model({})
    .volatile(() => ({
      /**
       * #volatile
       */
      snackbarMessages: observable.array<SnackbarMessage>(),
      /**
       * #volatile
       * the error currently shown in the stack-trace dialog. Kept off the
       * dialog queue so it can stack on top of an already-open dialog (e.g. the
       * one whose action raised the error) instead of waiting behind it
       */
      errorDialog: undefined as ErrorDialogState | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get snackbarMessageSet() {
        return new Map(self.snackbarMessages.map(s => [s.message, s]))
      },
    }))
    .actions(self => {
      // A pending auto-dismiss would otherwise fire on a destroyed session, and
      // in node keeps the process alive for its five seconds.
      // keyed by message, as removal is: an identical toast notified again
      // restarts the clock rather than vanishing on the first one's timer
      const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()
      addDisposer(self, () => {
        for (const timer of dismissTimers.values()) {
          clearTimeout(timer)
        }
      })
      return {
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
          // A plain info/success toast auto-hides; an actionable one persists
          // until acted on or dismissed (5s is too short to read and click the
          // action, and warning/error already persist).
          if ((level === 'info' || level === 'success') && !actions?.length) {
            clearTimeout(dismissTimers.get(message))
            dismissTimers.set(
              message,
              setTimeout(() => {
                dismissTimers.delete(message)
                this.removeSnackbarMessage(message)
              }, 5000),
            )
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
              this.setErrorDialog({ error, extra })
            },
          }
          const actions = action ? [reportAction, action] : [reportAction]
          this.pushSnackbarMessage(errorMessage, 'error', actions)
        },
        /**
         * #action
         */
        setErrorDialog(state: ErrorDialogState | undefined) {
          self.errorDialog = state
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
      }
    })
}
