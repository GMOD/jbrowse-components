import React from 'react'
import { types, Instance } from 'mobx-state-tree'
import { transaction } from 'mobx'
import { getSession } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import { saveAs } from 'file-saver'

// icons
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { Curves } from './components/Icons'

// locals
import baseModel from '../LinearComparativeView/model'
import ExportSvgDlg from './components/ExportSvgDialog'
import { renderToSvg } from './svgcomponents/SVGLinearSyntenyView'

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  scale?: number
  filename?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Wrapper?: React.FC<any>
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
 * extends the `LinearComparativeView` base model
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      baseModel(pluginManager),
      types.model('LinearSyntenyView', {
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
          self.views.forEach(view => view.showAllRegionsInAssembly())
        })
      },
    }))
    .actions(self => ({
      async exportSvg(opts: ExportSvgOptions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const html = await renderToSvg(self as any, opts)
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
              icon: VisibilityIcon,
            },
            {
              label: self.linkViews ? 'Unlink views' : 'Link views',
              onClick: self.toggleLinkViews,
              icon: self.linkViews ? LinkOffIcon : LinkIcon,
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
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDlg,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },
        menuItems() {
          return [
            ...superMenuItems(),
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDlg,
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
