export default pluginManager => {
  const { jbrequire } = pluginManager
  const { autorun } = jbrequire('mobx')
  const { types, getParent, addDisposer } = jbrequire('mobx-state-tree')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema, readConfObject } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )

  const configSchema = ConfigurationSchema(
    'SvInspectorView',
    {},
    { explicitlyTyped: true },
  )

  const SpreadsheetViewType = pluginManager.getViewType('SpreadsheetView')
  const CircularViewType = pluginManager.getViewType('CircularView')

  const minHeight = 40
  const defaultHeight = 500
  const headerHeight = 52
  const stateModel = types
    .model('SvInspectorView', {
      id: ElementId,
      type: types.literal('SvInspectorView'),
      width: 800,
      height: types.optional(
        types.refinement(
          'SvInspectorViewHeight',
          types.number,
          n => n >= minHeight,
        ),
        defaultHeight,
      ),
      configuration: configSchema,

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
        // the assembly name comes from the selected dataset in the spreadsheet view
        const { dataset } = self.spreadsheetView
        if (dataset) {
          return readConfObject(dataset, ['assembly', 'name'])
        }
        return undefined
      },

      get showCircularView() {
        return self.spreadsheetView.mode === 'display'
      },
    }))
    .volatile(() => ({
      SpreadsheetViewReactComponent: SpreadsheetViewType.ReactComponent,
      CircularViewReactComponent: CircularViewType.ReactComponent,
    }))
    .actions(self => ({
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
            self.spreadsheetView.setHeight(self.height - headerHeight)
            self.circularView.setHeight(self.height - headerHeight)
          }),
        )
        // bind circularview displayedRegions to spreadsheet dataset
        addDisposer(
          self,
          autorun(() => {
            const { dataset } = self.spreadsheetView
            if (dataset) {
              const assemblyName = readConfObject(dataset, ['assembly', 'name'])
              self.circularView.setDisplayedRegionsFromAssemblyName(
                assemblyName,
              )
            } else {
              self.circularView.setDisplayedRegions([])
            }
          }),
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
        return self.circularView.setDisplayedRegions(
          regions,
          isFromAssemblyName,
        )
      },
      // activateConfigurationUI() {
      //   getRoot(self).editConfiguration(self.configuration)
      // },
    }))

  return { stateModel, configSchema }
}
