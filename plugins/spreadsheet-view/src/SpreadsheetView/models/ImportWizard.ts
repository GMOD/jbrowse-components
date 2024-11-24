import { getSession, getEnv } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { types, getParent } from 'mobx-state-tree'
import type { Instance } from 'mobx-state-tree'

// 30MB
const IMPORT_SIZE_LIMIT = 30_000_000

const fileTypes = ['VCF', 'BED', 'BEDPE', 'STAR-Fusion']
const fileTypeParsers = {
  VCF: () => import('./importAdapters/VcfImport').then(r => r.parseVcfBuffer),
  BED: () => import('./importAdapters/BedImport').then(r => r.parseBedBuffer),
  BEDPE: () =>
    import('./importAdapters/BedpeImport').then(r => r.parseBedPEBuffer),
  'STAR-Fusion': () =>
    import('./importAdapters/STARFusionImport').then(
      r => r.parseSTARFusionBuffer,
    ),
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
    fileType: types.optional(types.enumeration(fileTypes), 'VCF'),
    /**
     * #property
     */
    hasColumnNameLine: true,
    /**
     * #property
     */
    columnNameLineNumber: 1,
    /**
     * #property
     */
    selectedAssemblyName: types.maybe(types.string),
  })
  .volatile(() => ({
    /**
     * #volatile
     */
    fileTypes,
    /**
     * #volatile
     */
    fileSource: undefined as any,
    /**
     * #volatile
     */
    error: undefined as unknown,
    /**
     * #volatile
     */
    loading: false,
  }))
  .views(self => ({
    /**
     * #getter
     */
    get isReadyToOpen() {
      return (
        !self.error &&
        self.fileSource &&
        (self.fileSource.blobId ||
          self.fileSource.localPath ||
          self.fileSource.uri)
      )
    },
    /**
     * #getter
     */
    get canCancel() {
      return getParent<any>(self).readyToDisplay
    },

    /**
     * #getter
     */
    get fileName() {
      return (
        self.fileSource.uri ||
        self.fileSource.localPath ||
        (self.fileSource.blobId && self.fileSource.name)
      )
    },

    /**
     * #getter
     */
    get requiresUnzip() {
      return this.fileName.endsWith('gz')
    },

    /**
     * #method
     */
    isValidRefName(refName: string, assemblyName?: string) {
      const { assemblyManager } = getSession(self)
      return !assemblyName
        ? false
        : assemblyManager.isValidRefName(refName, assemblyName)
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    setSelectedAssemblyName(s: string) {
      self.selectedAssemblyName = s
    },
    /**
     * #action
     */
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

    /**
     * #action
     */
    setColumnNameLineNumber(newnumber: number) {
      if (newnumber > 0) {
        self.columnNameLineNumber = newnumber
      }
    },

    /**
     * #action
     */
    setFileType(typeName: string) {
      self.fileType = typeName
    },

    /**
     * #action
     */
    setError(error: unknown) {
      console.error(error)
      self.loading = false
      self.error = error
    },

    /**
     * #action
     */
    setLoaded() {
      self.loading = false
      self.error = undefined
    },

    /**
     * #action
     */
    cancelButton() {
      self.error = undefined
      getParent<any>(self).setDisplayMode()
    },

    /**
     * #action
     * fetch and parse the file, make a new Spreadsheet model for it, then set
     * the parent to display it
     */
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

      const { fetchAndMaybeUnzip } = await import('@jbrowse/core/util')
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
        const data = await fetchAndMaybeUnzip(filehandle)
        this.setLoaded()
        getParent<any>(self).displaySpreadsheet({
          ...typeParser(data),
          assemblyName,
        })
      } catch (e) {
        console.error(e)
        this.setError(e)
      }
    },
  }))

export type ImportWizardStateModel = typeof ImportWizard
export type ImportWizardModel = Instance<ImportWizardStateModel>

export default ImportWizard
