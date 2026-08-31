import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession, isSessionWithAddSessionTrack } from '@jbrowse/core/util'
import {
  pendingLaunch,
  withLaunchInput,
} from '@jbrowse/core/util/withLaunchInput'
import { addDisposer, cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { reaction } from 'mobx'

import ImportWizard from './ImportWizard.ts'
import Spreadsheet from './SpreadsheetModel.tsx'
import { spreadsheetLaunchKeys } from './launchKeys.ts'
import { rowsExceedSnapshotBudget } from './snapshotBudget.ts'

import type { SpreadsheetSnapshot } from './SpreadsheetModel.tsx'
import type { SpreadsheetViewCommands } from './types.ts'
import type { LaunchInput } from '@jbrowse/core/util/withLaunchInput'
import type { Instance } from '@jbrowse/mobx-state-tree'

const minHeight = 40
const defaultHeight = 440

/**
 * #stateModel SpreadsheetView
 * #category view
 *
 * #example
 * Hand-authored under `defaultSession.views`, with every setting written
 * directly on the view object. `uri` loads a tabular file (VCF/BED/CSV/etc)
 * straight into the grid, skipping the import form; `assembly` is used to
 * resolve genomic coordinates in the rows:
 * ```js
 * {
 *   type: 'SpreadsheetView',
 *   assembly: 'hg38',
 *   uri: 'https://example.com/variants.vcf.gz',
 *   fileType: 'VCF',
 * }
 * ```
 */

export default function stateModelFactory() {
  const ImportWizardModel = ImportWizard()
  const model = types
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
           * the height of the sheet in pixels
           */
          height: types.stripDefault(types.number, defaultHeight),
          /**
           * #property
           * chrome switch, for an embed that sizes the view itself
           */
          hideVerticalResizeHandle: types.stripDefault(types.boolean, false),

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
           * transient launch state: the settings written on the view object
           * that need resolving before they can be view state — the file to
           * load, the assembly its rows are read against, the filter to open
           * it under. `preProcessSnapshot` moves them here off the snapshot,
           * the afterAttach reaction applies them and clears this, so a saved
           * session never retains it. Not written by hand: author every
           * setting directly on the view.
           */
          launch: types.frozen<
            LaunchInput<SpreadsheetViewCommands> | undefined
          >(),
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
           * the launch state that still has something to apply — the gate the
           * afterAttach reaction reads.
           */
          get pendingLaunch() {
            return pendingLaunch(self.launch)
          },
        }))
        .actions(self => ({
          /**
           * #action
           */
          setHeight(newHeight: number) {
            self.height = Math.max(newHeight, minHeight)
            return self.height
          },
          /**
           * #action
           * returns the distance actually applied, which is less than the
           * requested one once the drag runs into minHeight — the ResizeHandle
           * needs that to keep the bar under the pointer
           */
          resizeHeight(distance: number) {
            const oldHeight = self.height
            self.height = Math.max(self.height + distance, minHeight)
            return self.height - oldHeight
          },

          /**
           * #action
           * load a new spreadsheet and set our mode to display it. When the
           * incoming data has the same columns as what's shown (i.e. a
           * session-cached URI being re-fetched on reload), carry over the
           * user's column-visibility and SV-type filter — a fresh parse only
           * supplies columns/rowSet, so a plain replace would reset them. The
           * column match keeps this from leaking view state across different
           * files.
           */
          displaySpreadsheet(spreadsheet?: SpreadsheetSnapshot) {
            const prev = self.spreadsheet
            const sameColumns =
              !!prev &&
              !!spreadsheet &&
              JSON.stringify(prev.columns) ===
                JSON.stringify(spreadsheet.columns)
            self.spreadsheet = cast(
              sameColumns
                ? {
                    ...spreadsheet,
                    visibleColumns: prev.visibleColumns,
                    svTypeFilter: prev.svTypeFilter,
                    filterText: prev.filterText,
                  }
                : spreadsheet,
            )
          },

          /**
           * #action
           */
          setLaunch(launch?: LaunchInput<SpreadsheetViewCommands>) {
            self.launch = launch
          },

          /**
           * #action
           * Put the loaded file in the session as a track, so the linear and
           * breakpoint views a row opens have the records the row came from.
           * Without it every drill-down landed on an empty view and the reader
           * had to add the same file again by hand.
           *
           * Idempotent on purpose, and cheaply so: the trackId is derived from
           * the file's location and `addSessionTrackConf` dedupes against
           * everything the session can already resolve, so a reloaded session
           * re-importing its cached URI reuses the track rather than stacking a
           * second one. `trackConfForImportedFile` declines outright when a
           * track for the file already exists.
           *
           * **Nothing takes the track back out** — not `returnToImportForm`,
           * not closing this view. The views that opened it are the reason it
           * exists and they outlive the sheet, so removing it would empty a
           * linear view the reader is still reading. It is an ordinary session
           * track from that point on: it shows up in the track selector, it
           * saves with the session, and the reader closes it there. Importing a
           * second file adds a second track rather than replacing this one,
           * which is the same answer — they loaded two files.
           */
          registerImportedTrack(assemblyName: string) {
            const session = getSession(self)
            const conf =
              self.importWizard.trackConfForImportedFile(assemblyName)
            // a host with tracks turned off, or one whose session has no
            // session-track store, keeps the old behavior: the drill-downs open
            // without the callset rather than the import failing
            if (conf && isSessionWithAddSessionTrack(session)) {
              session.addSessionTrackConf(conf)
            }
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
              // the view can be closed while the file is still in flight, and
              // there is then neither a node to write to nor anyone left to
              // read the snackbar
              if (data && isAlive(self)) {
                self.displaySpreadsheet(data)
                self.registerImportedTrack(assemblyName)
              }
            } catch (e) {
              console.error(e)
              if (isAlive(self)) {
                session.notifyError(`${e}`, e)
              }
            }
          },
          /**
           * #action
           * drop the loaded sheet and the cached location together: leaving the
           * cache behind makes afterAttach re-fetch the dismissed file on the
           * next session load, putting the user back where they left
           */
          returnToImportForm() {
            self.displaySpreadsheet(undefined)
            self.importWizard.setCachedFileLocation(undefined)
          },
        }))
        .actions(self => ({
          /**
           * #action
           * apply a declarative init (from addView / sv-inspector): point the
           * import wizard at the file and load it. Without a uri there is
           * nothing to load, so the wizard is only seeded — the import form
           * then opens on the caller's assembly and file type instead of
           * whichever assembly happens to sort first
           */
          async applyInit(init: LaunchInput<SpreadsheetViewCommands>) {
            const { importWizard } = self
            const { assembly, uri, fileType, filterText } = init
            if (assembly) {
              importWizard.setSelectedAssemblyName(assembly)
            }
            if (uri) {
              const fileLocation = {
                uri,
                locationType: 'UriLocation' as const,
              }
              importWizard.setFileSource(fileLocation)
              // persist the location synchronously (fileSource is volatile) so
              // a snapshot taken before the async load finishes can still
              // reload the file instead of dropping to the import form. init is
              // cleared synchronously by the reaction, so the cache is the only
              // reconstruction source.
              importWizard.setCachedFileLocation(fileLocation)
            }
            // after setFileSource, which infers a type from the filename: an
            // explicit fileType is the caller overriding that inference
            if (fileType) {
              importWizard.setFileType(fileType)
            }
            // an assembly is what the rows' coordinates are read against, so a
            // spec naming a file and no assembly seeds the wizard and stops
            // there rather than importing against nothing
            if (uri && assembly) {
              await self.loadSpreadsheet(assembly)
              // after the load, because the sheet the filter belongs to does
              // not exist until then: displaySpreadsheet replaces the whole
              // node, so a filter set before it would be thrown away with the
              // sheet it was set on
              if (isAlive(self)) {
                self.spreadsheet?.setFilterText(filterText)
              }
            }
          },
        }))
        .actions(self => ({
          afterAttach() {
            const hadInit = !!self.pendingLaunch
            addDisposer(
              self,
              // Trigger on `init` ONLY. A reaction tracks just its data fn, so
              // the async apply can read width/etc without making them
              // dependencies — width churn (sv-inspector resizes, a workspace
              // tab settling, StrictMode) can no longer retrigger the load. `init`
              // is cleared synchronously up front so the same request can't be
              // applied twice; a later setLaunch supersedes. Re-entrancy is
              // excluded by the dependency graph rather than a guard flag.
              reaction(
                () => self.pendingLaunch,
                init => {
                  if (init) {
                    self.setLaunch(undefined)
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
           * #getter
           * Named to match LGV/dotplot/synteny/circular/breakpoint-split, which
           * is what `ViewContainer` reads to publish `data-view-phase`. Without
           * it this view published `ready` for its whole load, so a capture or a
           * browser test waiting on that attribute treated a spreadsheet still
           * fetching and parsing its VCF as settled — and there is no
           * display-level wait to fall back on here, since a spreadsheet mounts
           * no displays at all.
           *
           * The one view whose loading state renders *inside* its import form
           * rather than replacing it: the wizard keeps the chosen file, type and
           * assembly on screen and puts a spinner above them, which is more
           * useful than a bare loading screen that throws that context away. The
           * phase is about the model, not about which component is mounted.
           */
          get showLoading() {
            return self.importWizard.loading
          },
          /**
           * #getter
           * the track showing the loaded file, which the views a row drills
           * down into open. One derivation, not a recorded id: after
           * `registerImportedTrack` the session holds a track pointing at the
           * file, so the same location match that decides whether to build one
           * is also what finds it afterwards
           */
          get importedTrackId() {
            return self.importWizard.existingTrackId
          },
          /**
           * #method
           */
          menuItems() {
            return [
              {
                label: 'Return to import form',
                icon: FolderOpenIcon,
                onClick: () => {
                  self.returnToImportForm()
                },
              },
            ]
          },
        })),
    )
    .postProcessSnapshot(snap => {
      const { launch, spreadsheet, ...rest } = snap
      if (!spreadsheet) {
        return rest
      }
      const { rowSet, ...spreadsheetRest } = spreadsheet
      // omit rows when a URI is cached (re-fetched on load) or too large for
      // the session snapshot. The cheap test is deliberately first: a cached URI makes
      // the answer yes regardless of size
      const omitRows =
        !!rest.importWizard.cachedFileLocation ||
        rowsExceedSnapshotBudget(rowSet)
      return {
        ...rest,
        spreadsheet: omitRows ? spreadsheetRest : spreadsheet,
      }
    })

  return withLaunchInput(model, spreadsheetLaunchKeys)
}

export type SpreadsheetViewStateModel = ReturnType<typeof stateModelFactory>

// #region registry
declare module '@jbrowse/core/PluginManager' {
  interface ViewTypeRegistry {
    SpreadsheetView: SpreadsheetViewStateModel
  }
}
// #endregion
export type SpreadsheetViewModel = Instance<SpreadsheetViewStateModel>
