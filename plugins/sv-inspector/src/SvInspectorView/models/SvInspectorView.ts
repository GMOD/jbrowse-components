import clone from 'clone'
import { autorun, reaction } from 'mobx'
import { types, getParent, addDisposer, Instance } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { getSession, Region } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { SpreadsheetViewStateModel } from '@jbrowse/plugin-spreadsheet-view'
import { CircularViewStateModel } from '@jbrowse/plugin-circular-view'

// icons
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

// locals
import {
  canOpenBreakpointSplitViewFromTableRow,
  openBreakpointSplitViewFromTableRow,
  getFeatureForRow,
} from './breakpointSplitViewFromTableRow'

/**
 * #stateModel SvInspectorView
 * combination of a spreadsheetview and a circularview
 */
function SvInspectorViewF(pluginManager: PluginManager) {
  const SpreadsheetViewType = pluginManager.getViewType('SpreadsheetView')
  const CircularViewType = pluginManager.getViewType('CircularView')

  const SpreadsheetModel =
    SpreadsheetViewType.stateModel as SpreadsheetViewStateModel
  const CircularModel = CircularViewType.stateModel as CircularViewStateModel

  const minHeight = 400
  const defaultHeight = 550
  const headerHeight = 52
  const circularViewOptionsBarHeight = 52
  return types
    .compose(
      BaseViewModel,
      types.model('SvInspectorView', {
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
        height: types.optional(
          types.refinement(
            'SvInspectorViewHeight',
            types.number,
            n => n >= minHeight,
          ),
          defaultHeight,
        ),
        /**
         * #property
         */
        onlyDisplayRelevantRegionsInCircularView: false,
        /**
         * #property
         * switch specifying whether we are showing the import wizard or the
         * spreadsheet in our viewing area
         */
        mode: types.optional(
          types.enumeration('SvInspectorViewMode', ['import', 'display']),
          'import',
        ),
        /**
         * #property
         */
        spreadsheetView: types.optional(SpreadsheetModel, () =>
          SpreadsheetModel.create({
            type: 'SpreadsheetView',
            hideViewControls: true,
            hideVerticalResizeHandle: true,
          }),
        ),
        /**
         * #property
         */
        circularView: types.optional(CircularModel, () =>
          CircularModel.create({
            type: 'CircularView',
            hideVerticalResizeHandle: true,
            hideTrackSelectorButton: true,
            disableImportForm: true,
          }),
        ),
      }),
    )
    .volatile(() => ({
      width: 800,
      dragHandleHeight: 4,
    }))
    .views(self => ({
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
        const { assembly } = self.spreadsheetView
        return assembly ? readConfObject(assembly, 'name') : undefined
      },
      /**
       * #getter
       */
      get showCircularView() {
        return self.spreadsheetView.mode === 'display'
      },

      get features() {
        const session = getSession(self)
        const { spreadsheetView } = self
        const { outputRows = [] } = spreadsheetView
        return outputRows
          .map((r, i) => getFeatureForRow(session, spreadsheetView, r, i))
          .filter(f => !!f)
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
      setImportMode() {
        self.spreadsheetView.setImportMode()
      },
      /**
       * #action
       */
      setDisplayMode() {
        self.spreadsheetView.setDisplayMode()
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
        self.onlyDisplayRelevantRegionsInCircularView = Boolean(val)
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
          autorun(
            () => {
              const borderWidth = 1
              if (self.showCircularView) {
                const spreadsheetWidth = Math.round(self.width * 0.66)
                const circularViewWidth = self.width - spreadsheetWidth
                self.spreadsheetView.setWidth(spreadsheetWidth - borderWidth)
                self.circularView.setWidth(circularViewWidth)
              } else {
                self.spreadsheetView.setWidth(self.width)
              }
            },
            { name: 'SvInspectorView width binding' },
          ),
        )
        // synchronize subview heights
        addDisposer(
          self,
          autorun(
            () => {
              self.spreadsheetView.setHeight(self.height - headerHeight)
              self.circularView.setHeight(
                self.height - headerHeight - circularViewOptionsBarHeight,
              )
            },
            { name: 'SvInspectorView height binding' },
          ),
        )
        // bind circularview displayedRegions to spreadsheet assembly, mediated by
        // the onlyRelevantRegions toggle
        addDisposer(
          self,
          autorun(
            async () => {
              const {
                assemblyName,
                onlyDisplayRelevantRegionsInCircularView,
                circularView,
                featureRefNames,
              } = self
              const { tracks } = circularView
              const { assemblyManager } = getSession(self)
              if (!assemblyName) {
                return
              }
              const asm = await assemblyManager.waitForAssembly(assemblyName)
              if (!asm) {
                return
              }

              const { getCanonicalRefName, regions = [] } = asm
              if (onlyDisplayRelevantRegionsInCircularView) {
                if (tracks.length === 1) {
                  try {
                    // canonicalize the store's ref names if necessary
                    const refSet = new Set(
                      featureRefNames.map(r => getCanonicalRefName(r) || r),
                    )

                    circularView.setDisplayedRegions(
                      clone(regions.filter(r => refSet.has(r.refName))),
                    )
                  } catch (e) {
                    circularView.setError(e)
                  }
                }
              } else {
                circularView.setDisplayedRegions(regions)
              }
            },
            { name: 'SvInspectorView displayed regions bind' },
          ),
        )

        // bind circularview tracks to our track snapshot view
        addDisposer(
          self,
          reaction(
            () => ({
              generatedTrackConf: self?.featuresCircularTrackConfiguration,
              assemblyName: self?.assemblyName,
            }),
            data => {
              if (!data) {
                return
              }
              const { assemblyName, generatedTrackConf } = data
              const { circularView } = self
              // hide any visible tracks
              circularView.tracks.forEach(t =>
                circularView.hideTrack(t.configuration.trackId),
              )

              // put our track in as the only track
              if (assemblyName && generatedTrackConf) {
                // @ts-expect-error
                circularView.addTrackConf(generatedTrackConf, {
                  assemblyName,
                })
              }
            },
            {
              name: 'SvInspectorView track configuration binding',
              fireImmediately: true,
            },
          ),
        )

        // bind spreadsheetView row menu actions to us
        addDisposer(
          self,
          autorun(() => {
            self.spreadsheetView.setRowMenuItems(
              // these are the MenuItem entries for the row menu actions in the
              // spreadsheet view.  these are installed into the child
              // SpreadsheetView using an autorun below
              [
                {
                  label: 'Open split detail view',
                  icon: OpenInNewIcon,
                  // @ts-expect-error
                  disabled(spreadsheetView, spreadsheet, rowNumber, row) {
                    return !canOpenBreakpointSplitViewFromTableRow(
                      self,
                      spreadsheetView,
                      spreadsheet,
                      row,
                      rowNumber,
                    )
                  },

                  // @ts-expect-error
                  onClick(spreadsheetView, spreadsheet, rowNumber, row) {
                    openBreakpointSplitViewFromTableRow(
                      self,
                      spreadsheetView,
                      spreadsheet,
                      row,
                      rowNumber,
                    )
                  },
                },
              ],
            )
          }),
        )
      },
    }))
}

export type SvInspectorViewStateModel = ReturnType<typeof SvInspectorViewF>
export type SvInspectorViewModel = Instance<SvInspectorViewStateModel>

export default SvInspectorViewF
