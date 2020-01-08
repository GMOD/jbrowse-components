export default pluginManager => {
  const { jbrequire } = pluginManager
  const { autorun, reaction } = jbrequire('mobx')
  const { types, getParent, addDisposer, getRoot } = jbrequire(
    'mobx-state-tree',
  )
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { getSession, parseLocString } = jbrequire('@gmod/jbrowse-core/util')
  const { getConf, readConfObject } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )

  const SpreadsheetViewType = pluginManager.getViewType('SpreadsheetView')
  const CircularViewType = pluginManager.getViewType('CircularView')

  const minHeight = 500
  const defaultHeight = 500
  const headerHeight = 52
  const circularViewOptionsBarHeight = 52

  function parseLocStringAndConvertToInterbase(locstring) {
    const parsed = parseLocString(locstring)
    if (typeof parsed.start === 'number') parsed.start -= 1
    return parsed
  }

  // makes a feature data object (passed as `data` to a SimpleFeature constructor)
  // out of table row if the row has 2 location columns. undefined if not
  function makeAdHocSvFeature(sheet, rowNumber, row) {
    const { columns, columnDisplayOrder } = sheet
    const locationColumnNumbers = columnDisplayOrder.filter(columnNumber => {
      const columnDefinition = columns[columnNumber]
      return columnDefinition && columnDefinition.dataType.type === 'LocString'
    })
    // if we have 2 or more columns of type location, make a feature from them
    if (locationColumnNumbers.length >= 2) {
      // use the first two locations we found (first according to *displayed* order)
      const loc1 = parseLocStringAndConvertToInterbase(
        row.cells[locationColumnNumbers[0]].text,
      )
      const loc2 = parseLocStringAndConvertToInterbase(
        row.cells[locationColumnNumbers[1]].text,
      )

      // load all the other data in the row into an `otherData` object
      const otherData = {}
      columns.forEach((column, columnNumber) => {
        if (
          columnNumber === locationColumnNumbers[0] ||
          columnNumber === locationColumnNumbers[1]
        )
          return
        let { text } = row.cells[columnNumber]
        if (column.dataType.type === 'Number') text = parseFloat(text)
        otherData[column.name] = text
      })

      // make the final feature data out of otherData + the parsed locations
      return {
        ...otherData,
        uniqueId: `sv-inspector-adhoc-${rowNumber}`,
        refName: loc1.refName,
        start: loc1.start,
        end: loc1.end,
        mate: {
          refName: loc2.refName,
          start: loc2.start,
          end: loc2.end,
        },
      }
    }
    return undefined
  }

  const stateModel = types
    .model('SvInspectorView', {
      id: ElementId,
      type: types.literal('SvInspectorView'),
      width: 800,
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
          hideCloseButton: true,
          hideVerticalResizeHandle: true,
          hideTrackSelectorButton: true,
          disableImportForm: true,
        }),
      ),
    })
    .views(self => ({
      get selectedRows() {
        return self.spreadsheetView.rowSet.selectedRows
      },

      // this is to support the session model automatically pushing displayed regions
      // from the relevant assembly into this model
      get displayRegionsFromAssemblyName() {
        if (self.onlyDisplayRelevantRegionsInCircularView) return undefined

        // the assembly name comes from the selected dataset in the spreadsheet view
        const { dataset } = self.spreadsheetView
        if (dataset) {
          return readConfObject(dataset, ['assembly', 'name'])
        }
        return undefined
      },

      get assemblyName() {
        const { dataset } = self.spreadsheetView
        if (dataset) return readConfObject(dataset, ['assembly', 'name'])
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
        // bind circularview displayedRegions to spreadsheet dataset, mediated by
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
                if (onlyDisplayRelevantRegionsInCircularView) {
                  if (tracks.length === 1) {
                    const adapter = getConf(tracks[0], 'adapter')
                    const refNameMapP = getRoot(
                      self,
                    ).jbrowse.getRefNameMapForAdapter(adapter, assemblyName)

                    const regionsP = session.getRegionsForAssemblyName(
                      assemblyName,
                    )

                    Promise.all([refNameMapP, featuresRefNamesP, regionsP])
                      .then(([refNameMap, refNames, assemblyRegions]) => {
                        // console.log(refNameMap, refNames, assemblyRegions)
                        // canonicalize the store's ref names if necessary
                        const canonicalRefNames = new Set(
                          refNames.map(
                            refName => refNameMap.get(refName) || refName,
                          ),
                        )
                        const displayedRegions = assemblyRegions.filter(r =>
                          canonicalRefNames.has(r.refName),
                        )
                        circularView.setDisplayedRegions(
                          JSON.parse(JSON.stringify(displayedRegions)),
                        )
                      })
                      .catch(e => console.error(e))
                  }
                } else {
                  circularView.setDisplayedRegionsFromAssemblyName(assemblyName)
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

      setDisplayedRegions(regions, isFromAssemblyName = false) {
        // can only set displayed regions from the fromAssemblyName path.  this kind of sucks

        self.circularView.setDisplayedRegions(regions, isFromAssemblyName)
      },

      setOnlyDisplayRelevantRegionsInCircularView(val) {
        self.onlyDisplayRelevantRegionsInCircularView = Boolean(val)
      },
    }))

  return { stateModel }
}
