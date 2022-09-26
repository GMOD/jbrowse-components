import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import clone from 'clone'
import {
  getContainingView,
  getSession,
  Feature,
  Region,
} from '@jbrowse/core/util'

import { autorun, reaction } from 'mobx'
import { readConfObject } from '@jbrowse/core/configuration'
import { types, getParent, addDisposer, Instance } from 'mobx-state-tree'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// locals
import {
  canOpenBreakpointSplitViewFromTableRow,
  openBreakpointSplitViewFromTableRow,
  getSerializedFeatureForRow,
} from './breakpointSplitViewFromTableRow'
import PluginManager from '@jbrowse/core/PluginManager'
import { SpreadsheetViewModel } from '@jbrowse/plugin-spreadsheet-view'
import { CircularViewStateModel } from '@jbrowse/plugin-circular-view'

function defaultOnChordClick(
  feature: Feature,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chordTrack: any,
  pluginManager: PluginManager,
) {
  const session = getSession(chordTrack)
  session.setSelection(feature)
  const view = getContainingView(chordTrack)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewType = pluginManager.getViewType('BreakpointSplitView') as any
  const viewSnapshot = viewType.snapshotFromBreakendFeature(feature, view)

  // try to center the offsetPx
  viewSnapshot.views[0].offsetPx -= view.width / 2 + 100
  viewSnapshot.views[1].offsetPx -= view.width / 2 + 100
  viewSnapshot.featureData = feature.toJSON()

  session.addView('BreakpointSplitView', viewSnapshot)
}

const SvInspectorViewF = (pluginManager: PluginManager) => {
  const SpreadsheetViewType = pluginManager.getViewType('SpreadsheetView')
  const CircularViewType = pluginManager.getViewType('CircularView')

  const SpreadsheetModel =
    SpreadsheetViewType.stateModel as typeof SpreadsheetViewModel
  const CircularModel = CircularViewType.stateModel as CircularViewStateModel

  const minHeight = 400
  const defaultHeight = 550
  const headerHeight = 52
  const circularViewOptionsBarHeight = 52
  const model = types
    .model('SvInspectorView', {
      id: ElementId,
      type: types.literal('SvInspectorView'),
      dragHandleHeight: 4,
      height: types.optional(
        types.refinement(
          'SvInspectorViewHeight',
          types.number,
          n => n >= minHeight,
        ),
        defaultHeight,
      ),

      onlyDisplayRelevantRegionsInCircularView: false,

      // switch specifying whether we are showing the import wizard or the
      // spreadsheet in our viewing area
      mode: types.optional(
        types.enumeration('SvInspectorViewMode', ['import', 'display']),
        'import',
      ),

      spreadsheetView: types.optional(SpreadsheetModel, () =>
        SpreadsheetModel.create({
          type: 'SpreadsheetView',
          hideViewControls: true,
          hideVerticalResizeHandle: true,
        }),
      ),

      circularView: types.optional(CircularModel, () =>
        CircularModel.create({
          type: 'CircularView',
          hideVerticalResizeHandle: true,
          hideTrackSelectorButton: true,
          disableImportForm: true,
        }),
      ),
    })
    .volatile(() => ({
      width: 800,
    }))
    .views(self => ({
      get selectedRows() {
        // @ts-ignore
        return self.spreadsheetView.rowSet.selectedRows
      },

      get assemblyName() {
        const { assembly } = self.spreadsheetView
        return assembly ? readConfObject(assembly, 'name') : undefined
      },

      get showCircularView() {
        return self.spreadsheetView.mode === 'display'
      },

      get featuresAdapterConfigSnapshot() {
        const session = getSession(self)
        const { spreadsheetView } = self
        const { outputRows = [] } = spreadsheetView
        return {
          type: 'FromConfigAdapter',
          features: outputRows
            .map((r, i) =>
              getSerializedFeatureForRow(session, spreadsheetView, r, i),
            )
            .filter(f => !!f),
        }
      },

      // Promise<string[]> of refnames
      get featuresRefNamesP(): Promise<string[]> {
        const { getAdapterClass } =
          pluginManager.getAdapterType('FromConfigAdapter')
        return getAdapterClass().then(Adapter =>
          // @ts-ignore
          new Adapter(self.featuresAdapterConfigSnapshot).getRefNames(),
        )
      },
      get featuresCircularTrackConfiguration() {
        pluginManager.jexl.addFunction(
          'defaultOnChordClick',
          defaultOnChordClick,
        )
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
      setWidth(newWidth: number) {
        self.width = newWidth
      },
      setHeight(newHeight: number) {
        if (newHeight > minHeight) {
          self.height = newHeight
        } else {
          self.height = minHeight
        }
        return self.height
      },

      setImportMode() {
        self.spreadsheetView.setImportMode()
      },

      setDisplayMode() {
        self.spreadsheetView.setDisplayMode()
      },

      closeView() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getParent<any>(self, 2).removeView(self)
      },

      setDisplayedRegions(regions: Region[]) {
        self.circularView.setDisplayedRegions(regions)
      },

      setOnlyDisplayRelevantRegionsInCircularView(val: boolean) {
        self.onlyDisplayRelevantRegionsInCircularView = Boolean(val)
      },
    }))
    .actions(self => ({
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
                featuresRefNamesP,
              } = self
              const { tracks } = circularView
              const session = getSession(self)
              if (!assemblyName) {
                return
              }
              const { assemblyManager } = session
              const asm = await assemblyManager.waitForAssembly(assemblyName)
              if (!asm) {
                circularView.setDisplayedRegions([])
                return
              }
              const { getCanonicalRefName, regions = [] } = asm
              if (onlyDisplayRelevantRegionsInCircularView) {
                if (tracks.length === 1) {
                  try {
                    const refNames = await featuresRefNamesP
                    // canonicalize the store's ref names if necessary
                    const refSet = new Set(
                      refNames.map(r => getCanonicalRefName(r) || r),
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
              // hide any visible tracks
              self.circularView.tracks.forEach(track => {
                self.circularView.hideTrack(track.configuration.trackId)
              })

              // put our track in as the only track
              if (assemblyName && generatedTrackConf) {
                // @ts-ignore
                self.circularView.addTrackConf(generatedTrackConf, {
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
                  // @ts-ignore
                  disabled(spreadsheetView, spreadsheet, rowNumber, row) {
                    return !canOpenBreakpointSplitViewFromTableRow(
                      self,
                      spreadsheetView,
                      spreadsheet,
                      row,
                      rowNumber,
                    )
                  },

                  // @ts-ignore
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

  return { stateModel: types.compose(BaseViewModel, model) }
}

export type SvInspectorViewStateModel = ReturnType<
  typeof SvInspectorViewF
>['stateModel']
export type SvInspectorViewModel = Instance<SvInspectorViewStateModel>

export default SvInspectorViewF
