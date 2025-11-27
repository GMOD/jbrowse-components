import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { cast, types } from '@jbrowse/mobx-state-tree'

import ImportWizard from './ImportWizard'
import Spreadsheet from './SpreadsheetModel'

import type { SpreadsheetModel } from './SpreadsheetModel'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Instance } from '@jbrowse/mobx-state-tree'

const minHeight = 40
const defaultHeight = 440

/**
 * #stateModel SpreadsheetView
 * #category view
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function stateModelFactory() {
  const ImportWizardModel = ImportWizard()
  return types
    .compose(
      BaseViewModel,
      types
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
           */
          importWizard: types.optional(ImportWizardModel, () =>
            ImportWizardModel.create(),
          ),
          /**
           * #property
           */
          spreadsheet: types.maybe(Spreadsheet()),
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
          displaySpreadsheet(spreadsheet?: SpreadsheetModel) {
            self.spreadsheet = cast(spreadsheet)
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
                  self.displaySpreadsheet(undefined)
                },
              },
            ]
          },
        })),
    )
    .postProcessSnapshot(snap => {
      const { importWizard, spreadsheet } = snap
      if (importWizard.cachedFileLocation && spreadsheet) {
        // don't serialize spreadsheet rows if we have the importForm
        // xref https://github.com/mobxjs/@jbrowse/mobx-state-tree/issues/1524 for Omit
        const { rowSet, ...rest } = spreadsheet as Omit<
          typeof spreadsheet,
          symbol
        >

        return {
          ...(snap as Omit<typeof snap, symbol>),
          spreadsheet: rest,
        }
      } else if (spreadsheet) {
        // don't serialize spreadsheet rows if we have the importForm
        const { rowSet, ...rest } = spreadsheet as Omit<
          typeof spreadsheet,
          symbol
        >
        // check stringified length of rows if it is a localfile or similar.
        // try not to exceed localstorage limits
        return rowSet && JSON.stringify(rowSet).length > 1_000_000
          ? {
              ...(snap as Omit<typeof snap, symbol>),
              spreadsheet: rest,
            }
          : snap
      }
      return snap
    })
}

export type SpreadsheetViewStateModel = ReturnType<typeof stateModelFactory>
export type SpreadsheetViewModel = Instance<SpreadsheetViewStateModel>
