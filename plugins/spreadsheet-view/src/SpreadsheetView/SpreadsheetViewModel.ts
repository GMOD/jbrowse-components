import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession, isSessionWithAddSessionTrack } from '@jbrowse/core/util'
import { installInitAutorun } from '@jbrowse/core/util/installInitAutorun'
import {
  pendingLaunch,
  withLaunchInput,
} from '@jbrowse/core/util/withLaunchInput'
import { cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

import ImportWizard from './ImportWizard.ts'
import Spreadsheet from './SpreadsheetModel.tsx'
import { spreadsheetLaunchKeys } from './launchKeys.ts'
import { rowsExceedSnapshotBudget } from './snapshotBudget.ts'

import type { SpreadsheetSnapshot } from './SpreadsheetModel.tsx'
import type { SpreadsheetViewCommands } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { LaunchInput } from '@jbrowse/core/util/withLaunchInput'
import type { Instance } from '@jbrowse/mobx-state-tree'

const minHeight = 40
const defaultHeight = 440

/**
 * #stateModel SpreadsheetView
 * #category view
 * Shows a VCF, BED, BEDPE or STAR-Fusion file as a filterable table whose
 * rows open their genomic location in a new view.
 *
 * #example
 * Hand-authored under `defaultSession.views`, with every setting written
 * directly on the view object. `uri` loads a VCF, BED, BEDPE or STAR-Fusion file
 * straight into the grid, skipping the import form; `assembly` names the
 * assembly that resolves genomic coordinates in the rows:
 * ```js
 * {
 *   type: 'SpreadsheetView',
 *   assembly: 'hg38',
 *   uri: 'https://example.com/variants.vcf.gz',
 *   fileType: 'VCF',
 * }
 * ```
 */

export default function stateModelFactory(pluginManager?: PluginManager) {
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
           * trackIds the views a row opens start with, beside the loaded file's
           * own track: the tumor and normal alignments, a coverage track, an
           * assembly's synteny track
           */
          drilldownTracks: types.stripDefault(types.array(types.string), []),

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
           * transient launch keys lifted off the view object, applied on
           * attach and then cleared; author them directly on the view
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
           * the launch keys still waiting to be applied
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
           * returns the distance applied, which minHeight can cut short
           */
          resizeHeight(distance: number) {
            const oldHeight = self.height
            self.height = Math.max(self.height + distance, minHeight)
            return self.height - oldHeight
          },

          /**
           * #action
           * show a parsed sheet. One with the same columns as the sheet it
           * replaces, as a reloaded session's re-fetch is, keeps that sheet's
           * column visibility, filters and search
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
                    svEventFilter: prev.svEventFilter,
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
           * a failed launch's error, shown in the import form's banner
           */
          setError(error: unknown) {
            self.importWizard.setError(error)
          },

          /**
           * #action
           */
          setDrilldownTracks(trackIds: string[]) {
            self.drilldownTracks = cast(trackIds)
          },

          /**
           * #action
           * Put the loaded file in the session as a track, so the views a row
           * opens show the records it came from. Idempotent: a session that
           * already has a track for the file reuses it.
           *
           * Nothing removes the track, since the views that opened it outlive
           * the sheet; the reader closes it like any session track.
           */
          registerImportedTrack(assemblyName: string) {
            const session = getSession(self)
            const conf =
              self.importWizard.trackConfForImportedFile(assemblyName)
            // a host without session tracks opens the drill-downs without it
            if (conf && isSessionWithAddSessionTrack(session)) {
              session.addSessionTrackConf(conf)
            }
          },
        }))
        .actions(self => ({
          /**
           * #action
           * fetch, parse and show the wizard's file: the one path a launch, a
           * session reload and the Open button all take
           */
          async loadSpreadsheet(
            assemblyName: string,
            superseded?: () => boolean,
          ) {
            const session = getSession(self)
            try {
              const data = await self.importWizard.import(assemblyName)
              // a newer launch of this live view replaced the file
              if (data && isAlive(self) && !superseded?.()) {
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
           * drop the sheet and its cached location, so a session reload does
           * not fetch the dismissed file again
           */
          returnToImportForm() {
            self.displaySpreadsheet(undefined)
            self.importWizard.setCachedFileLocation(undefined)
          },
        }))
        .actions(self => ({
          /**
           * #action
           * point the import wizard at a launch's file and load it; without a
           * uri or an assembly, only seed the import form with what it names
           */
          async applyInit(
            init: LaunchInput<SpreadsheetViewCommands>,
            superseded?: () => boolean,
          ) {
            const { importWizard } = self
            const { assembly, uri, baseUri, fileType, filterText } = init
            const { svEventFilter } = init
            if (assembly) {
              importWizard.setSelectedAssemblyName(assembly)
            }
            if (uri) {
              const fileLocation = {
                uri,
                baseUri,
                locationType: 'UriLocation' as const,
              }
              importWizard.setFileSource(fileLocation)
              importWizard.setCachedFileLocation(fileLocation)
            }
            // after setFileSource, so it overrides the type the name implied
            if (fileType) {
              importWizard.setFileType(fileType)
            }
            if (uri && assembly) {
              await self.loadSpreadsheet(assembly, superseded)
              // the filters belong to the sheet the load just built
              if (isAlive(self) && !superseded?.()) {
                self.spreadsheet?.setFilterText(filterText)
                self.spreadsheet?.setSvEventFilter(svEventFilter)
              }
            }
          },
        }))
        .actions(self => ({
          afterAttach() {
            const hadInit = !!self.pendingLaunch
            installInitAutorun(self, {
              name: 'SpreadsheetViewInit',
              ready: () => true,
              materialized: () => !!self.spreadsheet,
              apply: (init, { superseded }) => self.applyInit(init, superseded),
            })
            // a reloaded session re-reads its cached file
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
           * true while the file loads, which `ViewContainer` publishes as
           * `data-view-phase`; the import form stays on screen under a spinner
           */
          get showLoading() {
            return self.importWizard.loading
          },
          /**
           * #getter
           * every track a row's drill-down opens with, the loaded file's own
           * first
           */
          get drilldownTrackIds(): string[] {
            const { existingTrackId } = self.importWizard
            return [
              ...(existingTrackId ? [existingTrackId] : []),
              ...self.drilldownTracks,
            ]
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
      const { spreadsheet, ...rest } = snap
      if (!spreadsheet) {
        return rest
      }
      const { rowSet, ...spreadsheetRest } = spreadsheet
      // rows a reload re-reads from the cached location, or too many to save
      const omitRows =
        !!rest.importWizard.cachedFileLocation ||
        rowsExceedSnapshotBudget(rowSet)
      return {
        ...rest,
        spreadsheet: omitRows ? spreadsheetRest : spreadsheet,
      }
    })

  return withLaunchInput(model, spreadsheetLaunchKeys, {
    registry: pluginManager,
    materialized: () => true,
  })
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
