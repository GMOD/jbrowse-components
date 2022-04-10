import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { getContainingView, getSession } from '@jbrowse/core/util'

import { autorun, reaction } from 'mobx'
import { readConfObject } from '@jbrowse/core/configuration'
import { types, getParent, addDisposer } from 'mobx-state-tree'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// locals
import {
  canOpenBreakpointSplitViewFromTableRow,
  openBreakpointSplitViewFromTableRow,
  getSerializedFeatureForRow,
} from './breakpointSplitViewFromTableRow'

function defaultOnChordClick(feature, chordTrack, pluginManager) {
  const session = getSession(chordTrack)
  session.setSelection(feature)
  const view = getContainingView(chordTrack)
  const viewType = pluginManager.getViewType('BreakpointSplitView')
  const viewSnapshot = viewType.snapshotFromBreakendFeature(feature, view)

  // try to center the offsetPx
  viewSnapshot.views[0].offsetPx -= view.width / 2 + 100
  viewSnapshot.views[1].offsetPx -= view.width / 2 + 100
  viewSnapshot.featureData = feature.data

  session.addView('BreakpointSplitView', viewSnapshot)
}

const SvInspectorViewF = pluginManager => {
  const SpreadsheetViewType = pluginManager.getViewType('SpreadsheetView')
  const CircularViewType = pluginManager.getViewType('CircularView')

  const minHeight = 400
  const defaultHeight = 500
  const headerHeight = 52
  const circularViewOptionsBarHeight = 52
  const model = types
    .model('SvInspectorView', {
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

      spreadsheetView: types.optional(SpreadsheetViewType.stateModel, () =>
        SpreadsheetViewType.stateModel.create({
          type: 'SpreadsheetView',
          hideViewControls: true,
          hideVerticalResizeHandle: true,
        }),
      ),

      circularView: types.optional(CircularViewType.stateModel, () =>
        CircularViewType.stateModel.create({
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
        return self.spreadsheetView.rowSet.selectedRows
      },

      get assemblyName() {
        const { assembly } = self.spreadsheetView
        if (assembly) {
          return readConfObject(assembly, 'name')
        }
        return undefined
      },

      get showCircularView() {
        return self.spreadsheetView.mode === 'display'
      },

      get featuresAdapterConfigSnapshot() {
        const session = getSession(self)
        return {
          type: 'FromConfigAdapter',
          features: (self.spreadsheetView.outputRows || [])
            .map((row, rowNumber) =>
              getSerializedFeatureForRow(
                session,
                self.spreadsheetView,
                row,
                rowNumber,
              ),
            )
            .filter(f => Boolean(f)),
        }
      },

      // Promise<string[]> of refnames
      get featuresRefNamesP() {
        const { AdapterClass: FromConfigAdapter } =
          pluginManager.getAdapterType('FromConfigAdapter')
        const adapter = new FromConfigAdapter(
          self.featuresAdapterConfigSnapshot,
        )
        return adapter.getRefNames()
      },

      get featuresCircularTrackConfiguration() {
        pluginManager.jexl.addFunction(
          'defaultOnChordClick',
          defaultOnChordClick,
        )
        const configuration = {
          type: 'VariantTrack',
          trackId: `sv-inspector-variant-track-${self.id}`,
          name: 'features from tabular data',
          adapter: self.featuresAdapterConfigSnapshot,
          assemblyNames: [self.assemblyName],
          displays: [
            {
              type: 'ChordVariantDisplay',
              displayId: `sv-inspector-variant-track-chord-display-${self.id}`,
              onChordClick: `jexl:defaultOnChordClick(feature, track, pluginManager)`,
              renderer: { type: 'StructuralVariantChordRenderer' },
            },
          ],
        }
        return configuration
      },
    }))
    .volatile(() => ({
      SpreadsheetViewReactComponent: SpreadsheetViewType.ReactComponent,
      CircularViewReactComponent: CircularViewType.ReactComponent,
      circularViewOptionsBarHeight,
    }))
    .actions(self => ({
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
              if (assemblyName) {
                const assembly = await session.assemblyManager.waitForAssembly(
                  assemblyName,
                )
                if (assembly) {
                  const { getCanonicalRefName, regions: assemblyRegions = [] } =
                    assembly
                  if (onlyDisplayRelevantRegionsInCircularView) {
                    if (tracks.length === 1) {
                      featuresRefNamesP
                        .then(featureRefNames => {
                          // canonicalize the store's ref names if necessary
                          const canonicalFeatureRefNames = new Set(
                            featureRefNames.map(
                              refName =>
                                getCanonicalRefName(refName) || refName,
                            ),
                          )
                          const displayedRegions = assemblyRegions.filter(r =>
                            canonicalFeatureRefNames.has(r.refName),
                          )
                          circularView.setDisplayedRegions(
                            JSON.parse(JSON.stringify(displayedRegions)),
                          )
                        })
                        .catch(e => circularView.setError(e))
                    }
                  } else {
                    circularView.setDisplayedRegions(assemblyRegions)
                  }
                } else {
                  circularView.setDisplayedRegions([])
                }
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
              generatedTrackConf:
                self && self.featuresCircularTrackConfiguration,
              assemblyName: self && self.assemblyName,
            }),
            data => {
              if (!data) {
                return
              }
              const { assemblyName, generatedTrackConf } = data
              // hide any visible tracks
              if (self.circularView.tracks.length) {
                self.circularView.tracks.forEach(track => {
                  self.circularView.hideTrack(track.configuration.trackId)
                })
              }

              // put our track in as the only track
              if (assemblyName && generatedTrackConf) {
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
              // these are the MenuItem entries for the row menu actions in the spreadsheet view.
              // these are installed into the child SpreadsheetView using an autorun below
              [
                {
                  label: 'Open split detail view',
                  icon: OpenInNewIcon,
                  disabled(spreadsheetView, spreadsheet, rowNumber, row) {
                    return !canOpenBreakpointSplitViewFromTableRow(
                      self,
                      spreadsheetView,
                      spreadsheet,
                      row,
                      rowNumber,
                    )
                  },
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
      setWidth(newWidth) {
        self.width = newWidth
      },
      setHeight(newHeight) {
        if (newHeight > minHeight) {
          self.height = newHeight
        } else {
          self.height = minHeight
        }
        return self.height
      },
      resizeHeight(distance) {
        const oldHeight = self.height
        const newHeight = self.setHeight(self.height + distance)
        return newHeight - oldHeight
      },

      setImportMode() {
        self.spreadsheetView.setImportMode()
      },

      setDisplayMode() {
        self.spreadsheetView.setDisplayMode()
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      setDisplayedRegions(regions) {
        self.circularView.setDisplayedRegions(regions)
      },

      setOnlyDisplayRelevantRegionsInCircularView(val) {
        self.onlyDisplayRelevantRegionsInCircularView = Boolean(val)
      },
    }))

  const stateModel = types.compose(BaseViewModel, model)

  return { stateModel }
}

export default SvInspectorViewF
