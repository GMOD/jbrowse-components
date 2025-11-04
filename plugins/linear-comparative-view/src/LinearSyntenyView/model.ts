import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { saveAs } from 'file-saver'
import { observable, transaction } from 'mobx'
import { types } from 'mobx-state-tree'

import { Curves } from './components/Icons'
import baseModel from '../LinearComparativeView/model'

import type { ExportSvgOptions, ImportFormSyntenyTrack } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from 'mobx-state-tree'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog'))
const DiagonalizationProgressDialog = lazy(
  () => import('./components/DiagonalizationProgressDialog'),
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
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      importFormSyntenyTrackSelections:
        observable.array<ImportFormSyntenyTrack>(),
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
        transaction(() => {
          for (const view of self.views) {
            view.showAllRegionsInAssembly()
          }
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async exportSvg(opts: ExportSvgOptions) {
        const { renderToSvg } = await import(
          './svgcomponents/SVGLinearSyntenyView'
        )
        const html = await renderToSvg(self as LinearSyntenyViewModel, opts)
        const blob = new Blob([html], { type: 'image/svg+xml' })
        saveAs(blob, opts.filename || 'image.svg')
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
              label: 'Show all regions',
              onClick: self.showAllRegions,
              description: 'Show entire genome assemblies',
              icon: VisibilityIcon,
              helpText:
                'This command will zoom out all views to display the entire genome assemblies. This is useful when you want to get a high-level overview of syntenic relationships across whole genomes or when you need to reset the view after zooming into specific regions.',
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
              label: 'Draw',
              subMenu: [
                {
                  label: 'Draw CIGAR',
                  checked: self.drawCIGAR,
                  type: 'checkbox',
                  description:
                    'If disabled, only draws the broad scale CIGAR match',
                  onClick: () => {
                    self.setDrawCIGAR(!self.drawCIGAR)
                  },
                  helpText:
                    'CIGAR strings encode detailed alignment information including matches, insertions, and deletions. When enabled, this option visualizes the fine-scale variations in syntenic alignments. Disable this for a cleaner view that shows only broad syntenic blocks.',
                },
                {
                  label: 'Draw only CIGAR matches',
                  checked: self.drawCIGARMatchesOnly,
                  type: 'checkbox',
                  description:
                    'If enabled, it hides the insertions and deletions in the CIGAR strings, helps with divergent',
                  onClick: () => {
                    self.setDrawCIGARMatchesOnly(!self.drawCIGARMatchesOnly)
                  },
                  helpText:
                    'When comparing divergent genomes, showing all insertions and deletions can clutter the view. This option filters the CIGAR visualization to show only the matching regions, providing a cleaner view of conserved syntenic blocks while hiding small-scale indels.',
                },
                {
                  label: 'Use curved lines',
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
                  label: 'Draw location markers',
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
              helpText:
                'Export the current synteny view as a scalable vector graphics (SVG) file. SVG format preserves quality at any zoom level and can be edited in vector graphics software like Inkscape or Adobe Illustrator. Perfect for creating publication-quality figures.',
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
}
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
