import { types, Instance } from 'mobx-state-tree'
import { ElementId } from '../../util/types/mst'
import { MenuItem } from '../../ui'

/**
 * #stateModel BaseViewModel
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BaseViewModel = types
  .model('BaseView', {
    /**
     * #property
     */
    id: ElementId,
    /**
     * #property
     * displayName is displayed in the header of the view, or assembly names
     * being used if none is specified
     */
    displayName: types.maybe(types.string),
  })
  .volatile((/* self */) => ({
    width: 800,
  }))
  .views((/* self */) => ({
    /**
     * #getter
     */
    menuItems(): MenuItem[] {
      return []
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    setDisplayName(name: string) {
      self.displayName = name
    },

    /**
     * #action
     * width is an "important" attribute of the view model, when it becomes set, it
     * often indicates when the app can start drawing to it. certain views like
     * lgv are strict about this because if it tries to draw before it knows the
     * width it should draw to, it may start fetching data for regions it doesn't
     * need to
     */
    setWidth(newWidth: number) {
      self.width = newWidth
    },
  }))

export default BaseViewModel
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IBaseViewModel extends Instance<typeof BaseViewModel> {}
