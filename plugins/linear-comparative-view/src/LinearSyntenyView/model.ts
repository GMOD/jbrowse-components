import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun, observable, when } from 'mobx'

import { Curves } from './components/Icons.tsx'
import baseModel from '../LinearComparativeView/model.ts'

import type {
  ExportSvgOptions,
  ImportFormSyntenyTrack,
  LinearSyntenyViewInit,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))
const DiagonalizationProgressDialog = lazy(
  () => import('./components/DiagonalizationProgressDialog.tsx'),
)

/**
 * #stateModel LinearSyntenyView
 * extends
 * - [LinearComparativeView](../linearcomparativeview)
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'LinearSyntenyView',
      baseModel(pluginManager),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearSyntenyView'),
        /**
         * #property/
         */
        drawCIGAR: true,
        /**
         * #property/
         */
        drawCIGARMatchesOnly: false,
        /**
         * #property
         */
        drawCurves: false,
        /**
         * #property
         */
        drawLocationMarkers: false,
        /**
         * #property
         * used for initializing the view from a session snapshot
         * example:
         * ```json
         * {
         *   views: [
         *     { loc: "chr1:1-100", assembly: "hg38", tracks: ["genes"] },
         *     { loc: "chr1:1-100", assembly: "mm39" }
         *   ],
         *   tracks: ["hg38_vs_mm39_synteny"]
         * }
         * ```
         */
        init: types.frozen<LinearSyntenyViewInit | undefined>(),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      importFormSyntenyTrackSelections:
        observable.array<ImportFormSyntenyTrack>(),
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hasSomethingToShow() {
        return self.views.length > 0 || !!self.init
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return self.isLoading || (!self.initialized && self.hasSomethingToShow)
      },
      /**
       * #getter
       * Whether to show the import form
       */
      get showImportForm() {
        return !self.hasSomethingToShow
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      importFormRemoveRow(idx: number) {
        self.importFormSyntenyTrackSelections.splice(idx, 1)
      },
      /**
       * #action
       */
      clearImportFormSyntenyTracks() {
        self.importFormSyntenyTrackSelections.clear()
      },
      /**
       * #action
       */
      setImportFormSyntenyTrack(arg: number, val: ImportFormSyntenyTrack) {
        self.importFormSyntenyTrackSelections[arg] = val
      },
      /**
       * #action
       */
      setDrawCurves(arg: boolean) {
        self.drawCurves = arg
      },
      /**
       * #action
       */
      setDrawCIGAR(arg: boolean) {
        self.drawCIGAR = arg
      },
      /**
       * #action
       */
      setDrawCIGARMatchesOnly(arg: boolean) {
        self.drawCIGARMatchesOnly = arg
      },
      /**
       * #action
       */
      setDrawLocationMarkers(arg: boolean) {
        self.drawLocationMarkers = arg
      },
      /**
       * #action
       */
      showAllRegions() {
        for (const view of self.views) {
          view.showAllRegionsInAssembly()
        }
      },
      /**
       * #action
       */
      setInit(init?: LinearSyntenyViewInit) {
        self.init = init
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async exportSvg(opts: ExportSvgOptions) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGLinearSyntenyView.tsx')
        const html = await renderToSvg(self as LinearSyntenyViewModel, opts)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { saveAs } = await import('file-saver-es')

        saveAs(
          new Blob([html], { type: 'image/svg+xml' }),
          opts.filename || 'image.svg',
        )
      },
    }))
    .views(self => {
      const superHeaderMenuItems = self.headerMenuItems
      const superMenuItems = self.menuItems
      return {
        /**
         * #method
         * includes a subset of view menu options because the full list is a
         * little overwhelming
         */
        headerMenuItems() {
          return [
            ...superHeaderMenuItems(),
            {
              label: 'Square view',
              onClick: self.squareView,
              description:
                'Makes both views use the same zoom level, adjusting to the average of each',
              icon: CropFreeIcon,
              helpText:
                'Square view synchronizes the zoom levels of both genome views by calculating the average zoom level and applying it to both panels. This helps ensure features are displayed at comparable scales, making it easier to compare syntenic regions visually.',
            },
            {
              label: 'Re-order chromosomes',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  DiagonalizationProgressDialog,
                  {
                    handleClose,
                    model: self,
                  },
                ])
              },
              icon: ShuffleIcon,
              description:
                "Reorder and reorient query regions to minimize crossing lines, also known as 'diagonalizing'",
              helpText:
                "This operation 'diagonalizes' the data which algorithmically reorders and reorients chromosomes to minimize crossing synteny lines, creating a more diagonal pattern. This makes it easier to identify large-scale genomic rearrangements, inversions, and translocations. The process may take a few moments for large genomes.",
            },
            {
              label: 'Show...',
              subMenu: [
                {
                  label: 'Show all regions',
                  onClick: self.showAllRegions,
                  description: 'Show entire genome assemblies',
                  icon: VisibilityIcon,
                  helpText:
                    'This command will zoom out all views to display the entire genome assemblies. This is useful when you want to get a high-level overview of syntenic relationships across whole genomes or when you need to reset the view after zooming into specific regions.',
                },
                {
                  label: 'Show dynamic controls',
                  type: 'checkbox',
                  checked: self.showDynamicControls,
                  onClick: () => {
                    self.setShowDynamicControls(!self.showDynamicControls)
                  },
                  helpText:
                    'Toggle visibility of dynamic controls like opacity and minimum length sliders. These controls allow you to adjust synteny visualization parameters in real-time.',
                },
                {
                  label: 'Show CIGAR insertions/deletions',
                  checked: self.drawCIGAR,
                  type: 'checkbox',
                  description:
                    'If disabled, only shows the broad scale CIGAR match',
                  onClick: () => {
                    self.setDrawCIGAR(!self.drawCIGAR)
                  },
                  helpText:
                    'CIGAR strings encode detailed alignment information including matches, insertions, and deletions. When enabled, this option visualizes the fine-scale variations in syntenic alignments. Disable this for a cleaner view that shows only broad syntenic blocks.',
                },
                {
                  label: 'Show CIGAR matches only',
                  checked: self.drawCIGARMatchesOnly,
                  type: 'checkbox',
                  description:
                    'If enabled, hides the insertions and deletions in the CIGAR strings',
                  onClick: () => {
                    self.setDrawCIGARMatchesOnly(!self.drawCIGARMatchesOnly)
                  },
                  helpText:
                    'When comparing divergent genomes, showing all insertions and deletions can clutter the view. This option filters the CIGAR visualization to show only the matching regions, providing a cleaner view of conserved syntenic blocks while hiding small-scale indels.',
                },
                {
                  label: 'Show curved lines',
                  type: 'checkbox',
                  checked: self.drawCurves,
                  icon: Curves,
                  onClick: () => {
                    self.setDrawCurves(!self.drawCurves)
                  },
                  helpText:
                    'Toggle between straight lines and smooth bezier curves for synteny connections. Curved lines can make the visualization more aesthetically pleasing and may help reduce visual clutter when many syntenic regions are displayed. Straight lines provide a more direct representation.',
                },
                {
                  label: 'Show location markers',
                  type: 'checkbox',
                  checked: self.drawLocationMarkers,
                  description:
                    'Draw periodic markers to show location within large matches',
                  onClick: () => {
                    self.setDrawLocationMarkers(!self.drawLocationMarkers)
                  },
                  helpText:
                    'Location markers add periodic visual indicators along long syntenic blocks, helping you track position and scale within large conserved regions. This is particularly useful when examining very long syntenic matches where it can be difficult to gauge relative position.',
                },
              ],
            },
            {
              label: 'Link views',
              type: 'checkbox',
              checked: self.linkViews,
              icon: LinkIcon,
              onClick: () => {
                self.setLinkViews(!self.linkViews)
              },
              helpText:
                'When linked, panning and zooming in one genome view will automatically adjust the other view to maintain the correspondence shown by synteny lines. This makes it easier to explore syntenic regions interactively. Unlink views to navigate each genome independently.',
            },
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: (): void => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
        /**
         * #method
         */
        menuItems() {
          return [
            ...superMenuItems(),
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async function initAutorun() {
              const { init, width } = self
              if (!width || !init) {
                return
              }

              const session = getSession(self)
              const { assemblyManager } = session

              try {
                // Wait for all assemblies to be ready and get their regions
                const assemblies = await Promise.all(
                  init.views.map(async v => {
                    const asm = await assemblyManager.waitForAssembly(
                      v.assembly,
                    )
                    if (!asm) {
                      throw new Error(`Assembly ${v.assembly} failed to load`)
                    }
                    return asm
                  }),
                )

                // Set up the views with displayed regions (not using init)
                self.setViews(
                  assemblies.map(asm => ({
                    type: 'LinearGenomeView' as const,
                    bpPerPx: 1,
                    offsetPx: 0,
                    hideHeader: true,
                    displayedRegions: asm.regions,
                  })),
                )

                // Wait for child views to initialize
                await Promise.all(
                  self.views.map(view => when(() => view.initialized)),
                )

                // Navigate to locations and show tracks on child views
                await Promise.all(
                  init.views.map(async (viewInit, idx) => {
                    const view = self.views[idx]
                    if (!view) {
                      return
                    }
                    if (viewInit.loc) {
                      await view.navToLocString(viewInit.loc, viewInit.assembly)
                    } else {
                      view.showAllRegionsInAssembly(viewInit.assembly)
                    }
                    if (viewInit.tracks) {
                      for (const trackId of viewInit.tracks) {
                        view.showTrack(trackId)
                      }
                    }
                  }),
                )

                // Show synteny tracks
                if (init.tracks) {
                  for (const trackId of init.tracks) {
                    self.showTrack(trackId)
                  }
                }

                // Clear init state
                self.setInit(undefined)
              } catch (e) {
                console.error(e)
                session.notifyError(`${e}`, e)
                self.setInit(undefined)
              }
            },
            { name: 'LinearSyntenyViewInit' },
          ),
        )
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        init,
        drawCIGAR,
        drawCIGARMatchesOnly,
        drawCurves,
        drawLocationMarkers,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(!drawCIGAR ? { drawCIGAR } : {}),
        ...(drawCIGARMatchesOnly ? { drawCIGARMatchesOnly } : {}),
        ...(drawCurves ? { drawCurves } : {}),
        ...(drawLocationMarkers ? { drawLocationMarkers } : {}),
      } as typeof snap
    })
}
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
