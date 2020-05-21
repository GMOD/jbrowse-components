export default pluginManager => {
  const { jbrequire } = pluginManager
  const { autorun, reaction } = jbrequire('mobx')
  const { types, getParent, addDisposer, getSnapshot } = jbrequire(
    'mobx-state-tree',
  )
  const BaseViewModel = jbrequire('@gmod/jbrowse-core/BaseViewModel')
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { readConfObject } = jbrequire('@gmod/jbrowse-core/configuration')

  const SpreadsheetViewType = pluginManager.getViewType('SpreadsheetView')
  const CircularViewType = pluginManager.getViewType('CircularView')

  const minHeight = 500
  const defaultHeight = 500
  const headerHeight = 52
  const circularViewOptionsBarHeight = 52

  const {
    makeAdHocSvFeatureFromTwoLocations,
    makeAdHocSvFeatureFromTwoRefStartEndSets,
  } = jbrequire(require('./adhocFeatureUtils'))

  // makes a feature data object (passed as `data` to a SimpleFeature constructor)
  // out of table row if the row has 2 location columns. undefined if not
  function makeAdHocSvFeature(sheet, rowNumber, row) {
    const { columns, columnDisplayOrder } = sheet
    const columnTypes = {}
    columnDisplayOrder.forEach(columnNumber => {
      const columnDefinition = columns[columnNumber]
      if (!columnTypes[columnDefinition.dataType.type])
        columnTypes[columnDefinition.dataType.type] = []
      columnTypes[columnDefinition.dataType.type].push(columnNumber)
    })
    const locationColumnNumbers = columnTypes.LocString || []
    const locStartColumnNumbers = columnTypes.LocStart || []
    const locEndColumnNumbers = columnTypes.LocEnd || []
    const locRefColumnNumbers = columnTypes.LocRef || []

    // if we have 2 or more columns of type location, make a feature from them
    if (locationColumnNumbers.length >= 2) {
      return makeAdHocSvFeatureFromTwoLocations(
        columns,
        locationColumnNumbers,
        row,
        rowNumber,
      )
    }
    if (
      locRefColumnNumbers.length >= 2 &&
      locStartColumnNumbers.length >= 2 &&
      locEndColumnNumbers.length >= 2
    ) {
      return makeAdHocSvFeatureFromTwoRefStartEndSets(
        columns,
        locRefColumnNumbers,
        locStartColumnNumbers,
        locEndColumnNumbers,
        row,
        rowNumber,
      )
    }
    return undefined
  }

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

      // switch specifying whether we are showing the import wizard or the spreadsheet in our viewing area
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
        if (assembly) return readConfObject(assembly, 'name')
        return undefined
      },

      get showCircularView() {
        return self.spreadsheetView.mode === 'display'
      },

      get featuresAdapterConfigSnapshot() {
        const features = (self.spreadsheetView.outputRows || [])
          .map((row, rowNumber) => {
            if (row.extendedData) {
              if (row.extendedData.vcfFeature)
                return row.extendedData.vcfFeature
              if (row.extendedData.feature) return row.extendedData.feature
            }
            const adhocFeature = makeAdHocSvFeature(
              self.spreadsheetView.spreadsheet,
              rowNumber,
              row,
            )
            if (adhocFeature) return adhocFeature
            return undefined
          })
          .filter(f => Boolean(f))
        return {
          type: 'FromConfigAdapter',
          features,
        }
      },

      // Promise<string[]> of refnames
      get featuresRefNamesP() {
        const {
          AdapterClass: FromConfigAdapter,
        } = pluginManager.getAdapterType('FromConfigAdapter')
        const adapter = new FromConfigAdapter(
          self.featuresAdapterConfigSnapshot,
        )
        return adapter.getRefNames()
      },

      get featuresCircularTrackConfiguration() {
        const configuration = {
          type: 'StructuralVariantChordTrack',
          trackId: `sv-inspector-sv-chord-track-${self.id}`,
          name: 'features from tabular data',
          renderer: { type: 'StructuralVariantChordRenderer' },
          adapter: self.featuresAdapterConfigSnapshot,
          assemblyNames: [self.assemblyName],
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
            () => {
              const {
                assemblyName,
                onlyDisplayRelevantRegionsInCircularView,
                circularView,
                featuresRefNamesP,
              } = self
              const { tracks } = circularView
              const session = getSession(self)
              if (assemblyName) {
                let { regions: assemblyRegions } = session.assemblyManager.get(
                  assemblyName,
                )
                if (!assemblyRegions) {
                  assemblyRegions = []
                } else {
                  assemblyRegions = getSnapshot(assemblyRegions)
                }
                if (onlyDisplayRelevantRegionsInCircularView) {
                  if (tracks.length === 1) {
                    const { getCanonicalRefName } = session.assemblyManager.get(
                      assemblyName,
                    )

                    featuresRefNamesP
                      .then(featureRefNames => {
                        // canonicalize the store's ref names if necessary
                        const canonicalFeatureRefNames = new Set(
                          featureRefNames.map(
                            refName => getCanonicalRefName(refName) || refName,
                          ),
                        )
                        const displayedRegions = assemblyRegions.filter(r =>
                          canonicalFeatureRefNames.has(r.refName),
                        )
                        circularView.setDisplayedRegions(
                          JSON.parse(JSON.stringify(displayedRegions)),
                        )
                      })
                      .catch(e => console.error(e))
                  }
                } else {
                  circularView.setDisplayedRegions(assemblyRegions)
                }
              } else {
                circularView.setDisplayedRegions([])
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
              generatedTrackConf: self.featuresCircularTrackConfiguration,
              assemblyName: self.assemblyName,
            }),
            ({ assemblyName, generatedTrackConf }) => {
              // hide any visible tracks
              if (self.circularView.tracks.length) {
                self.circularView.tracks.forEach(track => {
                  self.circularView.hideTrack(track.configuration)
                })
              }

              // put our track in as the only track
              if (assemblyName) {
                self.circularView.showTrack(generatedTrackConf, {
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
      },
      setWidth(newWidth) {
        self.width = newWidth
      },
      setHeight(newHeight) {
        if (newHeight > minHeight) self.height = newHeight
        else self.height = minHeight
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
