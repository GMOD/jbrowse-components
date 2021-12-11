import { IAnyModelType } from 'mobx-state-tree'
import { observable } from 'mobx'
import { NotificationLevel } from '../util/types'

export default function addSnackbarToModel(tree: IAnyModelType) {
  return tree.extend(() => {
    const snackbarMessages = observable.array()

    return {
      views: {
        get snackbarMessages() {
          return snackbarMessages
        },
      },
      actions: {
        notify(message: string, level?: NotificationLevel) {
          this.pushSnackbarMessage(message, level)
          if (level === 'info' || level === 'success') {
            setTimeout(() => {
              this.removeSnackbarMessage(message)
            }, 5000)
          }
        },

        pushSnackbarMessage(message: string, level?: NotificationLevel) {
          return snackbarMessages.push([message, level])
        },

        popSnackbarMessage() {
          return snackbarMessages.pop()
        },

        removeSnackbarMessage(message: string) {
          const element = snackbarMessages.find(f => f[0] === message)
          if (element) {
            snackbarMessages.remove(element)
          }
        },
      },
    }
  })
}
