import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { reaction } from 'mobx'

import ImportWizard from './ImportWizard.ts'
import Spreadsheet from './SpreadsheetModel.tsx'

import type { SpreadsheetSnapshot } from './SpreadsheetModel.tsx'
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
          offsetPx: types.stripDefault(types.number, 0),
          /**
           * #property
           */
          height: types.stripDefault(types.number, defaultHeight),
          /**
           * #property
           */
          hideVerticalResizeHandle: types.stripDefault(types.boolean, false),
          /**
           * #property
           */
          hideFilterControls: types.stripDefault(types.boolean, false),

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
            self.height = Math.max(self.height + distance, minHeight)
            return self.height - oldHeight
          },
          /**
           * #action
           */
          resizeWidth(distance: number) {
            const oldWidth = self.width
            self.width = self.width + distance
            return self.width - oldWidth
          },

          /**
           * #action
           * load a new spreadsheet and set our mode to display it
           */
          displaySpreadsheet(spreadsheet?: SpreadsheetSnapshot) {
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
          /**
           * #action
           * the single load funnel: fetch+parse via the import wizard, then
           * display the result. Every entry point (declarative init, cached
           * reload, the import form's Open button) routes through here so the
           * view stays the sole owner of displaySpreadsheet
           */
          async loadSpreadsheet(assemblyName: string) {
            const session = getSession(self)
            try {
              const data = await self.importWizard.import(assemblyName)
              if (data) {
                self.displaySpreadsheet(data)
              }
            } catch (e) {
              console.error(e)
              session.notifyError(`${e}`, e)
            }
          },
        }))
        .actions(self => ({
          /**
           * #action
           * apply a declarative init (from addView / sv-inspector): point the
           * import wizard at the file and load it
           */
          async applyInit(init: SpreadsheetViewInit) {
            self.importWizard.setSelectedAssemblyName(init.assembly)
            self.importWizard.setFileSource({
              uri: init.uri,
              locationType: 'UriLocation',
            })
            if (init.fileType) {
              self.importWizard.setFileType(init.fileType)
            }
            await self.loadSpreadsheet(init.assembly)
          },
        }))
        .actions(self => ({
          afterAttach() {
            const hadInit = !!self.init
            addDisposer(
              self,
              // Trigger on `init` ONLY. A reaction tracks just its data fn, so
              // the async apply can read width/etc without making them
              // dependencies — width churn (sv-inspector resizes, dockview /
              // StrictMode settling) can no longer retrigger the load. `init`
              // is cleared synchronously up front so the same request can't be
              // applied twice; a later setInit supersedes. Re-entrancy is
              // excluded by the dependency graph rather than a guard flag.
              reaction(
                () => self.init,
                init => {
                  if (init) {
                    self.setInit(undefined)
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    self.applyInit(init)
                  }
                },
                { fireImmediately: true, name: 'SpreadsheetViewInit' },
              ),
            )
            // reload a session-cached URI (init and a cached file are mutually
            // exclusive — fresh addView vs reloaded session — but guard anyway)
            const { importWizard } = self
            if (
              !hadInit &&
              importWizard.cachedFileLocation &&
              importWizard.selectedAssemblyName
            ) {
              importWizard.setFileSource(importWizard.cachedFileLocation)
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              self.loadSpreadsheet(importWizard.selectedAssemblyName)
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
                  self.displaySpreadsheet(undefined)
                },
              },
            ]
          },
        })),
    )
    .postProcessSnapshot(snap => {
      const { init, importWizard, spreadsheet, ...rest } = snap
      if (!spreadsheet) {
        return { ...rest, importWizard }
      }
      const { rowSet, ...spreadsheetRest } = spreadsheet
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
