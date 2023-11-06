import { types, getParent, Instance } from 'mobx-state-tree'
import { openLocation } from '@jbrowse/core/util/io'
import { getSession, getEnv } from '@jbrowse/core/util'
import { SpreadsheetViewStateModel } from './SpreadsheetView'

const IMPORT_SIZE_LIMIT = 40_000_000

const fileTypes = ['VCF', 'BED', 'BEDPE', 'STAR-Fusion']
const fileTypeParsers = {
  VCF: () => import('../importAdapters/VcfImport').then(r => r.parseVcfBuffer),
  BED: () => import('../importAdapters/BedImport').then(r => r.parseBedBuffer),
  BEDPE: () =>
    import('../importAdapters/BedpeImport').then(r => r.parseBedPEBuffer),
  'STAR-Fusion': () =>
    import('../importAdapters/STARFusionImport').then(
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

function stateModelFactory() {
  return types
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
      fileTypes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fileSource: undefined as any,
      error: undefined as unknown,
      loading: false,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get isReadyToOpen() {
        const { error, fileSource } = self
        return (
          !error &&
          (fileSource?.blobId || fileSource?.localPath || fileSource?.uri)
        )
      },

      /**
       * #getter
       */
      get fileName() {
        const { fileSource } = self
        return fileSource
          ? fileSource.uri ||
              fileSource.localPath ||
              (fileSource.blobId && fileSource.name)
          : undefined
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
        if (!assemblyName) {
          return false
        }
        return assemblyManager.isValidRefName(refName, assemblyName)
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
       * fetch and parse the file, make a new Spreadsheet model for it,
       * then set the parent to display it
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
        if (!typeParser) {
          throw new Error(`cannot open files of type '${self.fileType}'`)
        }

        const { unzip } = await import('@gmod/bgzf-filehandle')
        const { pluginManager } = getEnv(self)
        const filehandle = openLocation(self.fileSource, pluginManager)
        let stat
        try {
          stat = await filehandle.stat()
        } catch (e) {
          // not required for stat to succeed to proceed, but it is helpful
          console.warn(e)
        }

        try {
          if (stat && stat.size > IMPORT_SIZE_LIMIT) {
            throw new Error(
              `File is too big. Tabular files are limited to at most ${(
                IMPORT_SIZE_LIMIT / 1_000_000
              ).toLocaleString()}Mb.`,
            )
          }
          const buffer = await filehandle.readFile()
          const buf2 = self.requiresUnzip ? await unzip(buffer) : buffer
          const spreadsheet = await typeParser(buf2)
          this.setLoaded()
          getParent<SpreadsheetViewStateModel>(self).displaySpreadsheet(
            spreadsheet,
            assemblyName,
          )
        } catch (e) {
          console.error(e)
          this.setError(e)
        }
      },
    }))
}

export type ImportWizardStateModel = ReturnType<typeof stateModelFactory>
export type ImportWizardModel = Instance<ImportWizardStateModel>

export default stateModelFactory
