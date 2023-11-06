import clone from 'clone'
import { autorun, reaction } from 'mobx'
import { types, getParent, addDisposer, Instance } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { getSession, Region } from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { SpreadsheetViewStateModel } from '@jbrowse/plugin-spreadsheet-view'
import { CircularViewStateModel } from '@jbrowse/plugin-circular-view'

// icons
// import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

// locals
// import {
//   canOpenBreakpointSplitViewFromTableRow,
//   openBreakpointSplitViewFromTableRow,
//   getFeatureForRow,
// } from './breakpointSplitViewFromTableRow'

/**
 * #stateModel SvInspectorView
 * #category view
 * does not extend, but is a combination of a
 * - [SpreadsheetView](../spreadsheetview)
 * - [CircularView](../circularview)
 *
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
function SvInspectorViewF(pluginManager: PluginManager) {
  const SpreadsheetViewType = pluginManager.getViewType('SpreadsheetView')
  const CircularViewType = pluginManager.getViewType('CircularView')

  const SpreadsheetModel =
    SpreadsheetViewType.stateModel as SpreadsheetViewStateModel
  const CircularModel = CircularViewType.stateModel as CircularViewStateModel

  const minHeight = 400
  const defaultHeight = 550
  const circularViewOptionsBarHeight = 52
  return types
    .compose(
      'SvInspectorView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        id: ElementId,
        /**
         * #property
         */
        type: types.literal('SvInspectorView'),

        /**
         * #property
         */
        height: types.optional(types.number, defaultHeight),
        /**
         * #property
         */
        onlyDisplayRelevantRegionsInCircularView: false,

        /**
         * #property
         */
        spreadsheetView: types.optional(SpreadsheetModel, {
          hideVerticalResizeHandle: true,
          type: 'SpreadsheetView',
        }),
        /**
         * #property
         */
        circularView: types.optional(CircularModel, {
          type: 'CircularView',
          hideVerticalResizeHandle: true,
          hideTrackSelectorButton: true,
          disableImportForm: true,
        }),
      }),
    )
    .volatile(() => ({
      width: 800,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get initialized() {
        return self.spreadsheetView.initialized
      },
      /**
       * #getter
       */
      get selectedRows() {
        // @ts-expect-error
        return self.spreadsheetView.rowSet.selectedRows
      },
      /**
       * #getter
       */
      get assemblyName() {
        return self.spreadsheetView.assemblyName
      },
      /**
       * #getter
       */
      get showCircularView() {
        return self.spreadsheetView.initialized
      },

      /**
       * #getter
       */
      get features() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return [] as any[]
      },
      /**
       * #getter
       */
      get featuresAdapterConfigSnapshot() {
        return {
          type: 'FromConfigAdapter',
          features: this.features,
        }
      },
      /**
       * #getter
       */
      get featureRefNames() {
        const refs = this.features.map(r => r.refName)
        const CHR2 = this.features.flatMap(r => r.INFO?.CHR2).filter(f => !!f)
        return [...refs, ...CHR2]
      },
      /**
       * #getter
       */
      get featuresCircularTrackConfiguration() {
        return {
          type: 'VariantTrack',
          trackId: `sv-inspector-variant-track-${self.id}`,
          name: 'features from tabular data',
          adapter: this.featuresAdapterConfigSnapshot,
          assemblyNames: [this.assemblyName],
          displays: [
            {
              type: 'ChordVariantDisplay',
              displayId: `sv-inspector-variant-track-chord-display-${self.id}`,
              onChordClick: `jexl:defaultOnChordClick(feature, track, pluginManager)`,
              renderer: { type: 'StructuralVariantChordRenderer' },
            },
          ],
        }
      },
    }))
    .volatile(() => ({
      SpreadsheetViewReactComponent: SpreadsheetViewType.ReactComponent,
      CircularViewReactComponent: CircularViewType.ReactComponent,
      circularViewOptionsBarHeight,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.width = newWidth
      },
      /**
       * #action
       */
      setHeight(newHeight: number) {
        self.height = newHeight > minHeight ? newHeight : minHeight
        return self.height
      },
      /**
       * #action
       */
      closeView() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getParent<any>(self, 2).removeView(self)
      },
      /**
       * #action
       */
      setDisplayedRegions(regions: Region[]) {
        self.circularView.setDisplayedRegions(regions)
      },
      /**
       * #action
       */
      setOnlyDisplayRelevantRegionsInCircularView(val: boolean) {
        self.onlyDisplayRelevantRegionsInCircularView = val
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
            onClick: () => {
              self.spreadsheetView.speadsheet.setData(undefined)
            },
            icon: FolderOpenIcon,
          },
        ]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = self.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
      afterAttach() {
        // synchronize subview widths
        addDisposer(
          self,
          autorun(() => {
            const borderWidth = 1
            if (self.showCircularView) {
              const spreadsheetWidth = Math.round(self.width * 0.66)
              const circularViewWidth = self.width - spreadsheetWidth
              self.spreadsheetView.setWidth(spreadsheetWidth - borderWidth)
              self.circularView.setWidth(circularViewWidth)
            } else {
              self.spreadsheetView.setWidth(self.width)
            }
          }),
        )
        // synchronize subview heights
        addDisposer(
          self,
          autorun(() => {
            const { height } = self
            self.spreadsheetView.setHeight(height)
            self.circularView.setHeight(height - circularViewOptionsBarHeight)
          }),
        )
        // bind circularview displayedRegions to spreadsheet assembly, mediated
        // by the onlyRelevantRegions toggle
        addDisposer(
          self,
          autorun(async () => {
            const {
              assemblyName,
              onlyDisplayRelevantRegionsInCircularView,
              circularView,
              featureRefNames,
            } = self
            try {
              if (!circularView.initialized) {
                return
              }
              const { tracks } = circularView
              const { assemblyManager } = getSession(self)
              if (!assemblyName) {
                return
              }
              const asm = assemblyManager.get(assemblyName)
              if (!asm) {
                return
              }
              const { regions = [] } = asm
              if (onlyDisplayRelevantRegionsInCircularView) {
                if (tracks.length === 1) {
                  // canonicalize the store's ref names if necessary
                  const refSet = new Set(
                    featureRefNames.map(r => asm.getCanonicalRefName(r) || r),
                  )
                  circularView.setDisplayedRegions(
                    clone(regions.filter(r => refSet.has(r.refName))),
                  )
                }
              } else {
                circularView.setDisplayedRegions(regions)
              }
            } catch (e) {
              console.error(e)
              circularView.setError(e)
            }
          }),
        )
        // bind circularview tracks to our track snapshot view
        addDisposer(
          self,
          autorun(() => {
            const { assemblyName, featuresCircularTrackConfiguration } = self
            const { circularView } = self
            // hide any visible tracks
            circularView.tracks.forEach(t =>
              circularView.hideTrack(t.configuration.trackId),
            )
            // put our track in as the only track
            if (assemblyName && featuresCircularTrackConfiguration) {
              circularView.addTrackConf(featuresCircularTrackConfiguration)
            }
          }),
        )
        // // bind spreadsheetView row menu actions to us
        addDisposer(
          self,
          autorun(() => {
            // self.spreadsheetView.setRowMenuItems(
            //   // these are the MenuItem entries for the row menu actions in the
            //   // spreadsheet view.  these are installed into the child
            //   // SpreadsheetView using an autorun below
            //   [
            //     {
            //       label: 'Open split detail view',
            //       icon: OpenInNewIcon,
            //       // @ts-expect-error
            //       disabled(spreadsheetView, spreadsheet, rowNumber, row) {
            //         return !canOpenBreakpointSplitViewFromTableRow(
            //           self,
            //           spreadsheetView,
            //           spreadsheet,
            //           row,
            //           rowNumber,
            //         )
            //       },
            //       // @ts-expect-error
            //       onClick(spreadsheetView, spreadsheet, rowNumber, row) {
            //         openBreakpointSplitViewFromTableRow(
            //           self,
            //           spreadsheetView,
            //           spreadsheet,
            //           row,
            //           rowNumber,
            //         )
            //       },
            //     },
            //   ],
            // )
          }),
        )
      },
    }))
}

export type SvInspectorViewStateModel = ReturnType<typeof SvInspectorViewF>
export type SvInspectorViewModel = Instance<SvInspectorViewStateModel>

export default SvInspectorViewF
