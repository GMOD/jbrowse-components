import { IModelType, ModelProperties } from 'mobx-state-tree'
import { IObservableArray, observable } from 'mobx'
import { NotificationLevel, SnackAction } from '../util/types'

export interface SnackbarMessage {
  message: string
  level?: NotificationLevel
  action?: SnackAction
}

/**
 * #stateModel SnackbarModel
 * #category session
 */
function makeExtension(snackbarMessages: IObservableArray<SnackbarMessage>) {
  return {
    views: {
      /**
       * #getter
       */
      get snackbarMessages() {
        return snackbarMessages
      },
    },
    actions: {
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
      pushSnackbarMessage(
        message: string,
        level?: NotificationLevel,
        action?: SnackAction,
      ) {
        return snackbarMessages.push({ message, level, action })
      },
      /**
       * #action
       */
      popSnackbarMessage() {
        return snackbarMessages.pop()
      },
      /**
       * #action
       */
      removeSnackbarMessage(message: string) {
        const element = snackbarMessages.find(f => f.message === message)
        if (element) {
          snackbarMessages.remove(element)
        }
      },
    },
  }
}

export default function addSnackbarToModel<
  PROPS extends ModelProperties,
  OTHERS,
>(
  tree: IModelType<PROPS, OTHERS>,
): IModelType<
  PROPS,
  OTHERS &
    ReturnType<typeof makeExtension>['actions'] &
    ReturnType<typeof makeExtension>['views']
> {
  return tree.extend(() => {
    const snackbarMessages = observable.array<SnackbarMessage>()

    return makeExtension(snackbarMessages)
  })
}
