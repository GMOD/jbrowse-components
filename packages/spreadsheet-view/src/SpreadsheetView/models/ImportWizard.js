import { parseCsvBuffer, parseTsvBuffer, parseBedBuffer } from './ImportUtils'

import { parseVcfBuffer } from './VcfImport'
import set from 'set-value'

const IMPORT_SIZE_LIMIT = 300000

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent } = jbrequire('mobx-state-tree')
  const { openLocation } = jbrequire('@gmod/jbrowse-core/util/io')

  const fileTypes = ['CSV', 'TSV', 'VCF', 'BED']
  const fileTypeParsers = {
    CSV: parseCsvBuffer,
    TSV: parseTsvBuffer,
    VCF: parseVcfBuffer,
    BED: parseBedBuffer,
  }
  // regexp used to guess the type of a file or URL from its file extension
  const fileTypesRegexp = new RegExp(
    `\\.(${fileTypes.join('|')})(\\.gz)?$`,
    'i',
  )

  return types
    .model('SpreadsheetImportWizard', {
      fileSource: types.frozen(),
      fileType: types.optional(types.enumeration(fileTypes), 'CSV'),
      loading: false,

      hasColumnNameLine: true,
      columnNameLineNumber: 1,

      error: types.maybe(types.model({ message: '', stackTrace: '' })),
    })
    .volatile(() => ({
      fileTypes,
    }))
    .views(self => ({
      get isReadyToOpen() {
        return self.fileSource && (self.fileSource.blob || self.fileSource.uri)
      },
      get canCancel() {
        return getParent(self).readyToDisplay
      },
    }))
    .actions(self => ({
      setFileSource(newSource) {
        self.fileSource = newSource

        if (self.fileSource) {
          // try to autodetect the file type, ignore errors
          const name = self.fileSource.uri || self.fileSource.blob.name
          if (name) {
            const match = fileTypesRegexp.exec(name)
            if (match && match[1]) {
              self.fileType = match[1].toUpperCase()
            }
          }
        }
      },

      toggleHasColumnNameLine() {
        self.hasColumnNameLine = !self.hasColumnNameLine
      },

      setColumnNameLineNumber(newnumber) {
        if (newnumber > 0) self.columnNameLineNumber = newnumber
      },

      setFileType(typeName) {
        self.fileType = typeName
      },

      setError(error) {
        console.error(error)
        self.loading = false
        self.error = {
          message: String(error),
          stackTrace: String(error.stack || ''),
        }
      },

      setLoaded() {
        self.loading = false
        self.error = undefined
      },

      cancelButton() {
        self.error = undefined
        getParent(self).setDisplayMode()
      },

      // fetch and parse the file, make a new Spreadsheet model for it,
      // then set the parent to display it
      import() {
        try {
          if (!self.fileSource) return
          const typeParser = fileTypeParsers[self.fileType]
          if (!typeParser)
            throw new Error(`cannot open files of type '${self.fileType}'`)
          if (self.loading)
            throw new Error('cannot import, load already in progress')
          self.loading = true
          const filehandle = openLocation(self.fileSource)
          filehandle
            .stat()
            .then(stat => {
              if (stat.size > IMPORT_SIZE_LIMIT)
                throw new Error(
                  `File is too big. Tabular files are limited to at most ${(
                    IMPORT_SIZE_LIMIT / 1000
                  ).toLocaleString()}kb.`,
                )
            })
            .then(() => filehandle.readFile())
            .then(buffer => typeParser(buffer, self))
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
