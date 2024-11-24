import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'

// icons
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { types, getEnv, cast } from 'mobx-state-tree'

// locals
import ImportWizardModel from './ImportWizard'
import SpreadsheetModel from './Spreadsheet'
import type { MenuItem } from '@jbrowse/core/ui'
import type { SnapshotIn, Instance } from 'mobx-state-tree'

const minHeight = 40
const defaultHeight = 440

/**
 * #stateModel SpreadsheetView
 * #category view
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const model = types
  .model('SpreadsheetView', {
    /**
     * #property
     */
    type: types.literal('SpreadsheetView'),
    /**
     * #property
     */
    offsetPx: 0,
    /**
     * #property
     */
    height: types.optional(types.number, defaultHeight),
    /**
     * #property
     */
    hideVerticalResizeHandle: false,
    /**
     * #property
     */
    hideFilterControls: false,

    /**
     * #property
     * switch specifying whether we are showing the import wizard or the
     * spreadsheet in our viewing area
     */
    mode: types.optional(
      types.enumeration('SpreadsheetViewMode', ['import', 'display']),
      'import',
    ),
    /**
     * #property
     */
    importWizard: types.optional(ImportWizardModel, () =>
      ImportWizardModel.create(),
    ),
    /**
     * #property
     */
    spreadsheet: types.maybe(SpreadsheetModel),
  })
  .volatile(() => ({
    /**
     * #volatile
     */
    width: 400,
    /**
     * #volatile
     */
    rowMenuItems: [] as MenuItem[],
  }))
  .views(self => ({
    /**
     * #getter
     */
    get readyToDisplay() {
      return !!self.spreadsheet && self.spreadsheet.isLoaded
    },
    /**
     * #getter
     */
    get hideRowSelection() {
      return !!getEnv(self).hideRowSelection
    },

    /**
     * #getter
     */
    get assembly() {
      const name = self.spreadsheet?.assemblyName
      return name
        ? getSession(self).assemblyManager.get(name)?.configuration
        : undefined
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    setRowMenuItems(newItems: MenuItem[]) {
      self.rowMenuItems = newItems
    },
    /**
     * #action
     */
    setWidth(newWidth: number) {
      self.width = newWidth
      return self.width
    },
    /**
     * #action
     */
    setHeight(newHeight: number) {
      self.height = Math.max(newHeight, minHeight)
      return self.height
    },
    /**
     * #action
     */
    resizeHeight(distance: number) {
      const oldHeight = self.height
      const newHeight = this.setHeight(self.height + distance)
      return newHeight - oldHeight
    },
    /**
     * #action
     */
    resizeWidth(distance: number) {
      const oldWidth = self.width
      const newWidth = this.setWidth(self.width + distance)
      return newWidth - oldWidth
    },

    /**
     * #action
     * load a new spreadsheet and set our mode to display it
     */
    displaySpreadsheet(spreadsheet: SnapshotIn<typeof SpreadsheetModel>) {
      self.spreadsheet = cast(spreadsheet)
      self.mode = 'display'
    },
    /**
     * #action
     */
    setImportMode() {
      self.mode = 'import'
    },
    /**
     * #action
     */
    setDisplayMode() {
      if (self.readyToDisplay) {
        self.mode = 'display'
      }
    },
  }))
  .views(self => ({
    /**
     * #method
     */
    menuItems() {
      return [
        {
          label: 'Return to import form',
          icon: FolderOpenIcon,
          onClick: () => {
            self.setImportMode()
          },
        },
      ]
    },
  }))

const SpreadsheetView = types.compose(BaseViewModel, model)

export type SpreadsheetViewStateModel = typeof SpreadsheetView
export type SpreadsheetViewModel = Instance<SpreadsheetViewStateModel>

export default SpreadsheetView
