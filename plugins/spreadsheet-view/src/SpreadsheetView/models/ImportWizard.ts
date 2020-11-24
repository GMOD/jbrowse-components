import { getSession } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import { unzip } from '@gmod/bgzf-filehandle'
import { parseCsvBuffer, parseTsvBuffer } from '../importAdapters/ImportUtils'
import { parseVcfBuffer } from '../importAdapters/VcfImport'
import { parseBedBuffer, parseBedPEBuffer } from '../importAdapters/BedImport'
import { parseSTARFusionBuffer } from '../importAdapters/STARFusionImport'

const IMPORT_SIZE_LIMIT = 300000

export default (pluginManager: PluginManager) => {
  const { lib } = pluginManager
  const { types, getParent, getRoot } = lib['mobx-state-tree']
  const { openLocation } = lib['@jbrowse/core/util/io']
  const { readConfObject } = lib['@jbrowse/core/configuration']

  const fileTypes = ['CSV', 'TSV', 'VCF', 'BED', 'BEDPE', 'STAR-Fusion']
  const fileTypeParsers = {
    CSV: parseCsvBuffer,
    TSV: parseTsvBuffer,
    VCF: parseVcfBuffer,
    BED: parseBedBuffer,
    BEDPE: parseBedPEBuffer,
    'STAR-Fusion': parseSTARFusionBuffer,
  }
  // regexp used to guess the type of a file or URL from its file extension
  const fileTypesRegexp = new RegExp(
    `\\.(${fileTypes.join('|')})(\\.gz)?$`,
    'i',
  )

  return types
    .model('SpreadsheetImportWizard', {
      fileType: types.optional(types.enumeration(fileTypes), 'CSV'),
      loading: false,
      hasColumnNameLine: true,
      columnNameLineNumber: 1,
      selectedAssemblyIdx: 0,
    })
    .volatile(() => ({
      fileTypes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fileSource: undefined as any,
      error: undefined as Error | undefined,
    }))
    .views(self => ({
      get isReadyToOpen() {
        return (
          !self.error &&
          self.fileSource &&
          (self.fileSource.blob ||
            self.fileSource.localPath ||
            self.fileSource.uri)
        )
      },
      get canCancel() {
        return getParent(self).readyToDisplay
      },
      get assemblyChoices() {
        return getRoot(self).jbrowse.assemblies
      },
      get selectedAssemblyName() {
        const asm = getRoot(self).jbrowse.assemblies[self.selectedAssemblyIdx]
        if (asm) {
          return readConfObject(asm, 'name')
        }
        return undefined
      },

      get fileName() {
        return (
          self.fileSource.uri ||
          self.fileSource.localPath ||
          (self.fileSource.blob && self.fileSource.blob.name)
        )
      },

      get requiresUnzip() {
        return this.fileName.endsWith('gz')
      },

      isValidRefName(refName: string, assemblyName?: string) {
        return getSession(self).assemblyManager.isValidRefName(
          refName,
          assemblyName,
        )
      },
    }))
    .actions(self => ({
      setFileSource(newSource: unknown) {
        self.fileSource = newSource
        self.error = undefined

        if (self.fileSource) {
          // try to autodetect the file type, ignore errors
          const name = self.fileName

          if (name) {
            const match = fileTypesRegexp.exec(name)
            if (match && match[1]) {
              if (match[1] === 'tsv' && name.includes('star-fusion')) {
                self.fileType = 'STAR-Fusion'
              } else {
                self.fileType = match[1].toUpperCase()
              }
            }
          }
        }
      },

      setSelectedAssemblyIdx(idx: number) {
        self.selectedAssemblyIdx = idx
      },

      toggleHasColumnNameLine() {
        self.hasColumnNameLine = !self.hasColumnNameLine
      },

      setColumnNameLineNumber(newnumber: number) {
        if (newnumber > 0) self.columnNameLineNumber = newnumber
      },

      setFileType(typeName: string) {
        self.fileType = typeName
      },

      setError(error: Error) {
        console.error(error)
        self.loading = false
        self.error = error
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
          const typeParser =
            fileTypeParsers[self.fileType as keyof typeof fileTypeParsers]
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
            .then(buffer => {
              return self.requiresUnzip ? unzip(buffer) : buffer
            })
            .then(buffer => typeParser(buffer as Buffer, self))
            .then(spreadsheet => {
              this.setLoaded()
              getParent(self).displaySpreadsheet(spreadsheet)
            })
            .catch(this.setError)
        } catch (error) {
          this.setError(error)
        }
      },
    }))
}
