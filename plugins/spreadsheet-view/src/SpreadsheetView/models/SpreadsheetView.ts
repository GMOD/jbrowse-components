import { types, Instance } from 'mobx-state-tree'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'

// icons
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

// locals
import spreadsheetModelFactory, { SpreadsheetData } from './Spreadsheet'
import importWizardFactory from './ImportWizard'

const defaultHeight = 440

/**
 * #stateModel SpreadsheetView
 * #category view
 *
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

function stateModelFactory() {
  const ImportWizard = importWizardFactory()
  const SpreadsheetModelType = spreadsheetModelFactory()
  return types
    .compose(
      BaseViewModel,
      types.model('SpreadsheetView', {
        /**
         * #property
         */
        type: types.literal('SpreadsheetView'),
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
        importWizard: types.optional(ImportWizard, {}),
        /**
         * #property
         */
        spreadsheet: types.maybe(SpreadsheetModelType),
      }),
    )
    .volatile(() => ({
      width: 400,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get assemblyName() {
        return self.spreadsheet?.assemblyName
      },
      /**
       * #getter
       */
      get initialized() {
        return self.spreadsheet?.initialized
      },
      /**
       * #getter
       */
      get assembly() {
        const name = self.spreadsheet?.assemblyName
        return name ? getSession(self).assemblyManager.get(name) : undefined
      },
      /**
       * #getter
       */
      get features() {
        return self.spreadsheet?.features
      },
    }))
    .actions(self => ({
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
        self.height = newHeight
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
      displaySpreadsheet(spreadsheet: SpreadsheetData, assemblyName: string) {
        // @ts-expect-error
        self.spreadsheet = { assemblyName }
        // @ts-expect-error
        self.spreadsheet.setData(spreadsheet)
      },

      /**
       * #action
       */
      clearData() {
        self.spreadsheet = undefined
        self.importWizard.setSpreadsheetFilehandle()
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
            onClick: () => {
              self.clearData()
            },
            icon: FolderOpenIcon,
          },
        ]
      },
    }))
}

export type SpreadsheetViewStateModel = ReturnType<typeof stateModelFactory>
export type SpreadsheetViewModel = Instance<SpreadsheetViewStateModel>

export default stateModelFactory
