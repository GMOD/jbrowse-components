import { types, getParent, Instance } from 'mobx-state-tree'
import { openLocation } from '@jbrowse/core/util/io'
import { getSession, getEnv } from '@jbrowse/core/util'

// 30MB
const IMPORT_SIZE_LIMIT = 30_000_000

const fileTypes = ['CSV', 'TSV', 'VCF', 'BED', 'BEDPE', 'STAR-Fusion']
const fileTypeParsers = {
  BED: () => import('../importAdapters/BedImport').then(r => r.parseBedBuffer),
  BEDPE: () =>
    import('../importAdapters/BedImport').then(r => r.parseBedPEBuffer),
  CSV: () =>
    import('../importAdapters/ImportUtils').then(r => r.parseCsvBuffer),
  'STAR-Fusion': () =>
    import('../importAdapters/STARFusionImport').then(
      r => r.parseSTARFusionBuffer,
    ),
  TSV: () =>
    import('../importAdapters/ImportUtils').then(r => r.parseTsvBuffer),
  VCF: () => import('../importAdapters/VcfImport').then(r => r.parseVcfBuffer),
}
// regexp used to guess the type of a file or URL from its file extension
const fileTypesRegexp = new RegExp(`\\.(${fileTypes.join('|')})(\\.gz)?$`, 'i')

/**
 * #stateModel SpreadsheetImportWizard
 * #category view
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const ImportWizard = types
  .model('SpreadsheetImportWizard', {
    /**
     * #property
     */
    columnNameLineNumber: 1,

    /**
     * #property
     */
    fileType: types.optional(types.enumeration(fileTypes), 'CSV'),

    /**
     * #property
     */
    hasColumnNameLine: true,
    /**
     * #property
     */
    selectedAssemblyName: types.maybe(types.string),
  })
  .volatile(() => ({
    error: undefined as unknown,

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fileSource: undefined as any,
    fileTypes,
    loading: false,
  }))
  .views(self => ({
    get canCancel() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return getParent<any>(self).readyToDisplay
    },
    get fileName() {
      return (
        self.fileSource.uri ||
        self.fileSource.localPath ||
        (self.fileSource.blobId && self.fileSource.name)
      )
    },

    get isReadyToOpen() {
      return (
        !self.error &&
        self.fileSource &&
        (self.fileSource.blobId ||
          self.fileSource.localPath ||
          self.fileSource.uri)
      )
    },

    isValidRefName(refName: string, assemblyName?: string) {
      const { assemblyManager } = getSession(self)
      if (!assemblyName) {
        return false
      }
      return assemblyManager.isValidRefName(refName, assemblyName)
    },

    get requiresUnzip() {
      return this.fileName.endsWith('gz')
    },
  }))
  .actions(self => ({
    cancelButton() {
      self.error = undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getParent<any>(self).setDisplayMode()
    },
    // fetch and parse the file, make a new Spreadsheet model for it,
    // then set the parent to display it
    async import(assemblyName: string) {
      if (!self.fileSource) {
        return
      }

      if (self.loading) {
        throw new Error('Cannot import, load already in progress')
      }

      self.selectedAssemblyName = assemblyName
      self.loading = true
      const type = self.fileType as keyof typeof fileTypeParsers
      const typeParser = await fileTypeParsers[type]()
      if (!typeParser) {
        throw new Error(`cannot open files of type '${self.fileType}'`)
      }

      const { unzip } = await import('@gmod/bgzf-filehandle')
      const { pluginManager } = getEnv(self)
      const filehandle = openLocation(self.fileSource, pluginManager)
      try {
        const stat = await filehandle.stat()
        if (stat.size > IMPORT_SIZE_LIMIT) {
          throw new Error(
            `File is too big. Tabular files are limited to at most ${(
              IMPORT_SIZE_LIMIT / 1000
            ).toLocaleString()}kb.`,
          )
        }
      } catch (e) {
        // not required for stat to succeed to proceed, but it is helpful
        console.warn(e)
      }

      try {
        await filehandle
          .readFile()
          .then(buffer => (self.requiresUnzip ? unzip(buffer) : buffer))
          .then(buffer => typeParser(buffer, self))
          .then(spreadsheet => {
            this.setLoaded()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            getParent<any>(self).displaySpreadsheet(spreadsheet)
          })
      } catch (e) {
        this.setError(e)
      }
    },

    setColumnNameLineNumber(newnumber: number) {
      if (newnumber > 0) {
        self.columnNameLineNumber = newnumber
      }
    },

    setError(error: unknown) {
      console.error(error)
      self.loading = false
      self.error = error
    },

    setFileSource(newSource: unknown) {
      self.fileSource = newSource
      self.error = undefined

      if (self.fileSource) {
        // try to autodetect the file type, ignore errors
        const name = self.fileName

        if (name) {
          const firstMatch = fileTypesRegexp.exec(name)?.[1]
          if (firstMatch) {
            self.fileType =
              firstMatch === 'tsv' && name.includes('star-fusion')
                ? 'STAR-Fusion'
                : firstMatch.toUpperCase()
          }
        }
      }
    },

    setFileType(typeName: string) {
      self.fileType = typeName
    },

    setLoaded() {
      self.loading = false
      self.error = undefined
    },

    setSelectedAssemblyName(s: string) {
      self.selectedAssemblyName = s
    },

    toggleHasColumnNameLine() {
      self.hasColumnNameLine = !self.hasColumnNameLine
    },
  }))

export type ImportWizardStateModel = typeof ImportWizard
export type ImportWizardModel = Instance<ImportWizardStateModel>

export default ImportWizard
