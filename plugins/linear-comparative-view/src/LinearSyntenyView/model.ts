import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
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
            },
            {
              label: 'Show all regions',
              onClick: self.showAllRegions,
              description: 'Show entire genome assemblies',
              icon: VisibilityIcon,
            },
            {
              label: 'Draw CIGAR',
              checked: self.drawCIGAR,
              type: 'checkbox',
              description:
                'If disabled, only draws the broad scale CIGAR match',
              onClick: () => {
                self.setDrawCIGAR(!self.drawCIGAR)
              },
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
            },
            {
              label: 'Link views',
              type: 'checkbox',
              checked: self.linkViews,
              icon: LinkIcon,
              onClick: () => {
                self.setLinkViews(!self.linkViews)
              },
            },
            {
              label: 'Use curved lines',
              type: 'checkbox',
              checked: self.drawCurves,
              icon: Curves,
              onClick: () => {
                self.setDrawCurves(!self.drawCurves)
              },
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
}
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
