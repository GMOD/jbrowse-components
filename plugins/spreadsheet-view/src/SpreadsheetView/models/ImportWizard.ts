import { types, getParent, addDisposer, Instance } from 'mobx-state-tree'
import { openLocation } from '@jbrowse/core/util/io'
import {
  getSession,
  getEnv,
  FileLocation as FileLocationType,
} from '@jbrowse/core/util'
import { GenericFilehandle } from 'generic-filehandle'

// locals
import { autorun } from 'mobx'
import { getFileType, getFilename } from '../components/util'

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
async function maybeStat(f: GenericFilehandle) {
  let stat: { size: number } | undefined
  try {
    stat = await f.stat()
  } catch (e) {
    // not required for stat to succeed to proceed, but it is helpful
    console.warn(e)
  }
  return stat
}

/**
 * #stateModel SpreadsheetImportWizard
 */
function stateModelFactory() {
  return types
    .model('SpreadsheetImportWizard', {
      /**
       * #property
       */
      fileTypeOverride: types.maybe(types.string),
      /**
       * #property
       */
      selectedAssemblyName: types.maybe(types.string),
      /**
       * #property
       */
      spreadsheetFilehandle: types.frozen<FileLocationType | undefined>(),
    })
    .volatile(() => ({
      fileTypes,
      error: undefined as unknown,
      loading: false,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get fileType() {
        if (self.fileTypeOverride) {
          return self.fileTypeOverride
        } else if (self.spreadsheetFilehandle) {
          return getFileType(self.spreadsheetFilehandle)
        } else {
          return 'VCF'
        }
      },

      /**
       * #getter
       */
      get fileName(): string | undefined {
        return getFilename(self.spreadsheetFilehandle)
      },
      /**
       * #getter
       */
      get requiresUnzip() {
        return this.fileName?.endsWith('gz')
      },
      /**
       * #method
       */
      isValidRefName(refName: string, assemblyName?: string) {
        const { assemblyManager } = getSession(self)
        return assemblyName
          ? assemblyManager.isValidRefName(refName, assemblyName)
          : false
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
      setSpreadsheetFilehandle(newSource?: FileLocationType) {
        self.spreadsheetFilehandle = newSource
        self.error = undefined
      },
      /**
       * #action
       */
      setFileType(typeName: string) {
        self.fileTypeOverride = typeName
      },
      /**
       * #action
       */
      setError(error: unknown) {
        self.error = error
      },
      /**
       * #action
       */
      setLoading(arg: boolean) {
        self.loading = arg
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(async () => {
            try {
              const { spreadsheetFilehandle } = self
              if (!spreadsheetFilehandle) {
                return
              }

              this.setLoading(true)
              const typeParser =
                await fileTypeParsers[
                  self.fileType as keyof typeof fileTypeParsers
                ]()

              const { unzip } = await import('@gmod/bgzf-filehandle')
              const { pluginManager } = getEnv(self)
              const f = openLocation(spreadsheetFilehandle, pluginManager)
              const stat = await maybeStat(f)
              if (stat && stat.size > IMPORT_SIZE_LIMIT) {
                throw new Error(
                  `File is too big. Tabular files are limited to at most ${(
                    IMPORT_SIZE_LIMIT / 1_000_000
                  ).toLocaleString()}Mb.`,
                )
              }
              const buffer = await f.readFile()
              const buf2 = self.requiresUnzip ? await unzip(buffer) : buffer
              const spreadsheet = typeParser(buf2)
              getParent<any>(self).displaySpreadsheet(
                spreadsheet,
                self.selectedAssemblyName,
              )
            } catch (e) {
              console.error(e)
              this.setError(e)
            } finally {
              this.setLoading(false)
            }
          }),
        )
      },
    }))
}

export type ImportWizardStateModel = ReturnType<typeof stateModelFactory>
export type ImportWizardModel = Instance<ImportWizardStateModel>

export default stateModelFactory
