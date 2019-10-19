import {
  parseCsvBuffer,
  parseTsvBuffer,
  dataToSpreadsheetSnapshot,
} from './ImportUtils'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent, getRoot } = jbrequire('mobx-state-tree')

  const { openLocation } = jbrequire('@gmod/jbrowse-core/util/io')

  return types
    .model('SpreadsheetImportWizard', {
      fileSource: types.frozen(),
      fileType: types.optional(types.enumeration(['csv', 'tsv']), 'csv'),
      loading: false,

      errorObject: types.optional(types.frozen()),
    })
    .views(self => ({
      get isReadyToOpen() {
        return self.fileSource && (self.fileSource.blob || self.fileSource.url)
      },
      get canCancel() {
        return getParent(self).readyToDisplay
      },
    }))
    .actions(self => ({
      setFileSource(newSource) {
        self.fileSource = newSource
      },

      setError(error) {
        console.error(error)
        self.loading = false
        self.errorObject = error
      },

      setLoaded() {
        self.loading = false
      },

      cancelButton() {
        getParent(self).setDisplayMode()
      },

      // fetch and parse the file, make a new Spreadsheet model for it,
      // then set the parent to display it
      import() {
        try {
          if (!self.fileSource) return
          const typeParser = { csv: parseCsvBuffer, tsv: parseTsvBuffer }[
            self.fileType
          ]
          if (!typeParser)
            throw new Error(`cannot open files of type '${self.fileType}'`)
          self.loading = true
          const filehandle = openLocation(self.fileSource)
          filehandle
            .readFile()
            .then(typeParser)
            .then(dataToSpreadsheetSnapshot)
            .then(spreadsheet => {
              self.setLoaded()
              getParent(self).displaySpreadsheet(spreadsheet)
            })
            .catch(self.setError)
        } catch (error) {
          self.setError(error)
        }
      },
    }))
}
