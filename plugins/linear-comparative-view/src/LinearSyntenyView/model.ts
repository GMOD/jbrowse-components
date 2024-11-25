import type React from 'react'
import { lazy } from 'react'
import { getSession } from '@jbrowse/core/util'

// icons
import CropFreeIcon from '@mui/icons-material/CropFree'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { saveAs } from 'file-saver'
import { transaction } from 'mobx'
import { types } from 'mobx-state-tree'
import { Curves } from './components/Icons'

// locals
import baseModel from '../LinearComparativeView/model'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from 'mobx-state-tree'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog'))

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  scale?: number
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  fontSize?: number
  rulerHeight?: number
  textHeight?: number
  paddingHeight?: number
  headerHeight?: number
  cytobandHeight?: number
  themeName?: string
  trackLabels?: string
}

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
         * #property
         */
        drawCurves: false,
      }),
    )
    .actions(self => ({
      /**
       * #action
       */
      toggleCurves() {
        self.drawCurves = !self.drawCurves
      },
      /**
       * #action
       */
      toggleCIGAR() {
        self.drawCIGAR = !self.drawCIGAR
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
              onClick: self.toggleCIGAR,
              checked: self.drawCIGAR,
              type: 'checkbox',
              description: 'Draws per-base CIGAR level alignments',
            },
            {
              label: 'Use curved lines',
              type: 'checkbox',
              checked: self.drawCurves,
              onClick: self.toggleCurves,
              icon: Curves,
            },
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: (): void => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDialog,
                  { model: self, handleClose },
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
                  { model: self, handleClose },
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
