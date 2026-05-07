import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { autorun } from 'mobx'

import ImportWizard from './ImportWizard.ts'
import Spreadsheet from './SpreadsheetModel.tsx'

import type { SpreadsheetModel } from './SpreadsheetModel.tsx'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface SpreadsheetViewInit {
  assembly: string
  uri: string
  fileType?: string
}

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
          /**
           * #property
           * used for initializing the view from a session snapshot
           */
          init: types.frozen<SpreadsheetViewInit | undefined>(),
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

          /**
           * #action
           */
          setInit(init?: SpreadsheetViewInit) {
            self.init = init
          },
        }))
        .actions(self => ({
          afterAttach() {
            addDisposer(
              self,
              autorun(
                async function spreadsheetViewInitAutorun() {
                  const { init, width } = self
                  if (width && init) {
                    const session = getSession(self)
                    try {
                      self.importWizard.setSelectedAssemblyName(init.assembly)
                      self.importWizard.setFileSource({
                        uri: init.uri,
                        locationType: 'UriLocation',
                      })
                      if (init.fileType) {
                        self.importWizard.setFileType(init.fileType)
                      }
                      await self.importWizard.import(init.assembly)
                    } catch (e) {
                      console.error(e)
                      session.notifyError(`${e}`, e)
                    } finally {
                      self.setInit(undefined)
                    }
                  }
                },
                { name: 'SpreadsheetViewInit' },
              ),
            )
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
      // xref for Omit https://github.com/mobxjs/mobx-state-tree/issues/1524
      const { init, importWizard, spreadsheet, ...rest } = snap as Omit<
        typeof snap,
        symbol
      >
      if (!spreadsheet) {
        return { ...rest, importWizard }
      }
      const { rowSet, ...spreadsheetRest } = spreadsheet as Omit<
        typeof spreadsheet,
        symbol
      >
      // omit rows when a URI is cached (re-fetched on load) or too large for localStorage
      const omitRows =
        importWizard.cachedFileLocation ??
        (rowSet !== undefined && JSON.stringify(rowSet).length > 1_000_000)
      return {
        ...rest,
        importWizard,
        spreadsheet: omitRows ? spreadsheetRest : spreadsheet,
      }
    })
}

export type SpreadsheetViewStateModel = ReturnType<typeof stateModelFactory>
export type SpreadsheetViewModel = Instance<SpreadsheetViewStateModel>
