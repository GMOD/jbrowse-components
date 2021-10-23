import {
  types,
  getParent,
  getEnv,
  cast,
  SnapshotIn,
  Instance,
} from 'mobx-state-tree'
import { observable } from 'mobx'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { readConfObject } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import { getSession, InstanceOfModelReturnedBy } from '@jbrowse/core/util'
import DoneIcon from '@material-ui/icons/Done'

import Spreadsheet from './Spreadsheet'
import ImportWizard from './ImportWizard'
import FilterControls from './FilterControls'

export type MenuItemWithDisabledCallback = MenuItem & {
  disabled?:
    | boolean
    | ((
        viewModel: unknown,
        spreadsheetModel: InstanceOfModelReturnedBy<typeof Spreadsheet>,
        rowNumber: number,
        row: Instance<ReturnType<typeof Spreadsheet>>['rowSet']['rows'][0],
      ) => boolean)
}

const defaultRowMenuItems: MenuItemWithDisabledCallback[] = [
  {
    label: 'Toggle select',
    icon: DoneIcon,
    onClick(
      _view: unknown,
      spreadsheet: Instance<ReturnType<typeof Spreadsheet>>,
    ) {
      const rowNumber = spreadsheet.rowMenuPosition?.rowNumber
      if (rowNumber !== undefined) {
        spreadsheet.rowSet.rows[rowNumber - 1].toggleSelect()
      }
    },
  },
]

const SpreadsheetViewModelF = (pluginManager: PluginManager) => {
  const { load } = pluginManager
  const SpreadsheetModel = load(Spreadsheet)
  const ImportWizardModel = load(ImportWizard)
  const FilterControlsModel = load(FilterControls)

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

      // switch specifying whether we are showing the import wizard or the spreadsheet in our viewing area
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
      rowMenuItems: observable(defaultRowMenuItems),
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
        self.rowMenuItems.replace(newItems)
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
        getParent(self, 2).removeView(self)
      },
    }))

  const stateModel = types.compose(BaseViewModel, model)

  return stateModel
}

export default SpreadsheetViewModelF
