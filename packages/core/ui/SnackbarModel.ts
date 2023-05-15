import { IModelType, ModelProperties } from 'mobx-state-tree'
import { IObservableArray, observable } from 'mobx'
import { NotificationLevel, SnackAction } from '../util/types'

/**
 * #stateModel SnackbarModel
 * #category session
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeExtension(snackbarMessages: IObservableArray<any>) {
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
        return snackbarMessages.push([message, level, action])
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
        const element = snackbarMessages.find(f => f[0] === message)
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
    const snackbarMessages = observable.array()

    return makeExtension(snackbarMessages)
  })
}
