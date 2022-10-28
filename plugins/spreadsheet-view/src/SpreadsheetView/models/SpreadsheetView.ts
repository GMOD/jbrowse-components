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
    label: 'Toggle select',
    icon: DoneIcon,
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
const model = types
  .model('SpreadsheetView', {
    type: types.literal('SpreadsheetView'),
    offsetPx: 0,
    height: types.optional(
      types.refinement(
        'SpreadsheetViewHeight',
        types.number,
        n => n >= minHeight,
      ),
      defaultHeight,
    ),

    hideViewControls: false,
    hideVerticalResizeHandle: false,
    hideFilterControls: false,

    filterControls: types.optional(FilterControlsModel, () =>
      FilterControlsModel.create({}),
    ),

    // switch specifying whether we are showing the import wizard or the
    // spreadsheet in our viewing area
    mode: types.optional(
      types.enumeration('SpreadsheetViewMode', ['import', 'display']),
      'import',
    ),
    importWizard: types.optional(ImportWizardModel, () =>
      ImportWizardModel.create(),
    ),
    spreadsheet: types.maybe(SpreadsheetModel),
  })
  .volatile(() => ({
    width: 400,
    rowMenuItems: defaultRowMenuItems,
  }))
  .views(self => ({
    get readyToDisplay() {
      return !!self.spreadsheet && self.spreadsheet.isLoaded
    },

    get hideRowSelection() {
      return !!getEnv(self).hideRowSelection
    },

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

    get assembly() {
      const name = self.spreadsheet?.assemblyName
      if (name) {
        const assemblies = getSession(self).assemblies
        return assemblies?.find(asm => readConfObject(asm, 'name') === name)
      }
      return undefined
    },
  }))
  .actions(self => ({
    setRowMenuItems(newItems: MenuItem[]) {
      self.rowMenuItems = newItems
    },
    setWidth(newWidth: number) {
      self.width = newWidth
      return self.width
    },
    setHeight(newHeight: number) {
      if (newHeight > minHeight) {
        self.height = newHeight
      } else {
        self.height = minHeight
      }
      return self.height
    },
    resizeHeight(distance: number) {
      const oldHeight = self.height
      const newHeight = this.setHeight(self.height + distance)
      return newHeight - oldHeight
    },
    resizeWidth(distance: number) {
      const oldWidth = self.width
      const newWidth = this.setWidth(self.width + distance)
      return newWidth - oldWidth
    },

    /** load a new spreadsheet and set our mode to display it */
    displaySpreadsheet(spreadsheet: SnapshotIn<typeof SpreadsheetModel>) {
      self.filterControls.clearAllFilters()
      self.spreadsheet = cast(spreadsheet)
      self.mode = 'display'
    },

    setImportMode() {
      self.mode = 'import'
    },

    setDisplayMode() {
      if (self.readyToDisplay) {
        self.mode = 'display'
      }
    },

    closeView() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getParent<any>(self, 2).removeView(self)
    },
  }))

const SpreadsheetView = types.compose(BaseViewModel, model)

export type SpreadsheetViewStateModel = typeof SpreadsheetView
export type SpreadsheetViewModel = Instance<SpreadsheetViewStateModel>

export default SpreadsheetView
