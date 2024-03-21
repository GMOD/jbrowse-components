import {
  types,
  getParent,
  getEnv,
  cast,
  SnapshotIn,
  Instance,
} from 'mobx-state-tree'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { readConfObject } from '@jbrowse/core/configuration'
import { MenuItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'

// icons
import DoneIcon from '@mui/icons-material/Done'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

import SpreadsheetModel from './Spreadsheet'
import ImportWizardModel from './ImportWizard'
import FilterControlsModel from './FilterControls'

type Spreadsheet = Instance<typeof SpreadsheetModel>

export type MenuItemWithDisabledCallback = MenuItem & {
  disabled?:
    | boolean
    | ((
        viewModel: unknown,
        spreadsheetModel: Spreadsheet,
        rowNumber: number,
        row: Spreadsheet['rowSet']['rows'][0],
      ) => boolean)
}

const defaultRowMenuItems: MenuItemWithDisabledCallback[] = [
  {
    icon: DoneIcon,
    label: 'Toggle select',
    onClick(_view: unknown, spreadsheet: Spreadsheet) {
      const rowNumber = spreadsheet.rowMenuPosition?.rowNumber
      if (rowNumber !== undefined) {
        spreadsheet.rowSet.rows[+rowNumber - 1].toggleSelect()
      }
    },
  },
]

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
    filterControls: types.optional(FilterControlsModel, () =>
      FilterControlsModel.create({}),
    ),

    /**
     * #property
     */
    height: types.optional(
      types.refinement(
        'SpreadsheetViewHeight',
        types.number,
        n => n >= minHeight,
      ),
      defaultHeight,
    ),

    /**
     * #property
     */
    hideFilterControls: false,

    /**
     * #property
     */
    hideVerticalResizeHandle: false,

    /**
     * #property
     */
    importWizard: types.optional(ImportWizardModel, () =>
      ImportWizardModel.create(),
    ),

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
    offsetPx: 0,

    /**
     * #property
     */
    spreadsheet: types.maybe(SpreadsheetModel),

    /**
     * #property
     */
    type: types.literal('SpreadsheetView'),
  })
  .volatile(() => ({
    rowMenuItems: defaultRowMenuItems,
    width: 400,
  }))
  .views(self => ({
    /**
     * #getter
     */
    get assembly() {
      const name = self.spreadsheet?.assemblyName
      if (name) {
        const assemblies = getSession(self).assemblies
        return assemblies?.find(asm => readConfObject(asm, 'name') === name)
      }
      return undefined
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
    get outputRows() {
      if (self.spreadsheet && self.spreadsheet.rowSet.isLoaded) {
        const selected = self.spreadsheet.rowSet.selectedFilteredRows
        if (selected.length) {
          return selected
        }
        return self.spreadsheet.rowSet.sortedFilteredRows
      }
      return undefined
    },

    /**
     * #getter
     */
    get readyToDisplay() {
      return !!self.spreadsheet && self.spreadsheet.isLoaded
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    closeView() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getParent<any>(self, 2).removeView(self)
    },

    /**
     * #action
     * load a new spreadsheet and set our mode to display it
     */
    displaySpreadsheet(spreadsheet: SnapshotIn<typeof SpreadsheetModel>) {
      self.filterControls.clearAllFilters()
      self.spreadsheet = cast(spreadsheet)
      self.mode = 'display'
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
     */
    setDisplayMode() {
      if (self.readyToDisplay) {
        self.mode = 'display'
      }
    },

    /**
     * #action
     */
    setHeight(newHeight: number) {
      self.height = newHeight > minHeight ? newHeight : minHeight
      return self.height
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
  }))
  .views(self => ({
    /**
     * #method
     */
    menuItems() {
      return [
        {
          icon: FolderOpenIcon,
          label: 'Return to import form',
          onClick: () => self.setImportMode(),
        },
      ]
    },
  }))

const SpreadsheetView = types.compose(BaseViewModel, model)

export type SpreadsheetViewStateModel = typeof SpreadsheetView
export type SpreadsheetViewModel = Instance<SpreadsheetViewStateModel>

export default SpreadsheetView
