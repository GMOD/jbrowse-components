import { readConfObject } from '@gmod/jbrowse-core/configuration'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent, getRoot, getEnv } = jbrequire('mobx-state-tree')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')

  const SpreadsheetModel = jbrequire(require('./Spreadsheet'))
  const ImportWizardModel = jbrequire(require('./ImportWizard'))
  const FilterControlsModel = jbrequire(require('./FilterControls'))

  const minHeight = 40
  const defaultHeight = 440
  const stateModel = types
    .model('SpreadsheetView', {
      id: ElementId,
      type: types.literal('SpreadsheetView'),
      offsetPx: 0,
      width: 400,
      height: types.optional(
        types.refinement(
          'SpreadsheetViewHeight',
          types.number,
          n => n >= minHeight,
        ),
        defaultHeight,
      ),

      hideViewControls: false,
      hideVerticalResizeHandle: false,
      hideFilterControls: false,

      filterControls: types.optional(FilterControlsModel, () =>
        FilterControlsModel.create({}),
      ),

      // switch specifying whether we are showing the import wizard or the spreadsheet in our viewing area
      mode: types.optional(
        types.enumeration('SpreadsheetViewMode', ['import', 'display']),
        'import',
      ),
      importWizard: types.optional(ImportWizardModel, () =>
        ImportWizardModel.create(),
      ),
      spreadsheet: types.maybe(SpreadsheetModel),
    })
    .views(self => ({
      get readyToDisplay() {
        return !!self.spreadsheet
      },

      get hideRowSelection() {
        return !!getEnv(self).hideRowSelection
      },

      get outputRows() {
        if (self.spreadsheet && self.spreadsheet.rowSet.isLoaded) {
          const selected = self.spreadsheet.rowSet.selectedFilteredRows
          if (selected.length) return selected
          return self.spreadsheet.rowSet.sortedFilteredRows
        }
        return undefined
      },

      get dataset() {
        if (self.spreadsheet && self.spreadsheet.datasetName) {
          const { datasets } = getRoot(self).jbrowse
          const dataset = (datasets || []).find(
            ds => readConfObject(ds, 'name') === self.spreadsheet.datasetName,
          )
          if (dataset) {
            return dataset
          }
        }
        return undefined
      },
    }))
    .actions(self => ({
      setWidth(newWidth) {
        self.width = newWidth
        return self.width
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
      resizeWidth(distance) {
        const oldWidth = self.width
        const newWidth = self.setWidth(self.width + distance)
        return newWidth - oldWidth
      },

      // load a new spreadsheet and set our mode to display it
      displaySpreadsheet(spreadsheet) {
        self.spreadsheet = spreadsheet
        self.mode = 'display'
      },

      setImportMode() {
        self.mode = 'import'
      },

      setDisplayMode() {
        if (self.readyToDisplay) self.mode = 'display'
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },
    }))

  return { stateModel }
}
