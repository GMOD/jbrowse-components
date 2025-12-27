import { readConfObject } from '@jbrowse/core/configuration'
import { getEnv, getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getParent, types } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const IMPORT_SIZE_LIMIT = 100_000_000

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

const adapterTypeMap: Record<string, { fileType: string; locationKey: string }> =
  {
    VcfAdapter: { fileType: 'VCF', locationKey: 'vcfLocation' },
    VcfTabixAdapter: { fileType: 'VCF', locationKey: 'vcfGzLocation' },
    BedAdapter: { fileType: 'BED', locationKey: 'bedLocation' },
    BedTabixAdapter: { fileType: 'BED', locationKey: 'bedGzLocation' },
    BedpeAdapter: { fileType: 'BEDPE', locationKey: 'bedpeLocation' },
  }

function getAdapterInfo(adapter: Record<string, unknown>) {
  const entry = adapterTypeMap[adapter.type as string]
  if (!entry) {
    return undefined
  }
  const loc =
    (adapter[entry.locationKey] as FileLocation) ??
    (adapter as unknown as FileLocation)
  return { fileType: entry.fileType, loc }
}

// regexp used to guess the type of a file or URL from its file extension
const fileTypesRegexp = new RegExp(
  String.raw`\.(${fileTypes.join('|')})(\.gz)?$`,
  'i',
)

/**
 * #stateModel SpreadsheetImportWizard
 * #category view
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function stateModelFactory() {
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

      /**
       * #property
       * used specifically for UriLocation's
       */
      cachedFileLocation: types.frozen<FileLocation | undefined>(),
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
          self.fileSource &&
          (self.fileSource.blobId ||
            self.fileSource.localPath ||
            self.fileSource.uri)
        )
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

      /**
       * #method
       */
      tracksForAssembly(selectedAssembly: string) {
        const session = getSession(self)
        const { tracks, sessionTracks = [] } = session
        const allTracks = [
          ...tracks,
          ...sessionTracks,
        ] as AnyConfigurationModel[]
        return allTracks
          .flatMap(track => {
            const assemblyNames = readConfObject(track, 'assemblyNames') ?? []
            if (!assemblyNames.includes(selectedAssembly)) {
              return []
            }
            const adapter = readConfObject(track, 'adapter')
            const info = getAdapterInfo(adapter)
            if (!info) {
              return []
            }
            const category = readConfObject(track, 'category') ?? []
            const categoryStr = category.join(',')
            return {
              track,
              label: [
                categoryStr ? `[${categoryStr}]` : '',
                getTrackName(track, session),
              ]
                .filter(f => !!f)
                .join(' '),
              assemblyNames,
              type: info.fileType,
              loc: info.loc,
            }
          })
          .sort((a, b) => a.label.localeCompare(b.label))
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
        self.error = error
      },

      /**
       * #action
       */
      setLoading(arg: boolean) {
        self.loading = arg
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
       */
      setCachedFileHandle(arg: FileLocation) {
        self.cachedFileLocation = arg
      },
    }))
    .actions(self => ({
      /**
       * #action
       * fetch and parse the file, make a new Spreadsheet model for it, then set
       * the parent to display it
       */
      async import(assemblyName: string) {
        if (!self.fileSource) {
          return
        }

        self.selectedAssemblyName = assemblyName
        const type = self.fileType as keyof typeof fileTypeParsers
        const typeParser = await fileTypeParsers[type]()

        const { fetchAndMaybeUnzip } = await import('@jbrowse/core/util')
        const { pluginManager } = getEnv(self)
        const filehandle = openLocation(self.fileSource, pluginManager)
        self.setLoading(true)
        try {
          const stat = await filehandle.stat()
          if (stat.size > IMPORT_SIZE_LIMIT) {
            self.setError(
              `File is too big. Tabular files are limited to at most ${(
                IMPORT_SIZE_LIMIT / 1000
              ).toLocaleString()}kb.`,
            )
            return
          }
        } catch (e) {
          // not required for stat to succeed to proceed, but it is helpful
          console.warn(e)
        } finally {
          self.setLoading(false)
        }

        self.setLoading(true)
        try {
          if (self.fileSource.uri) {
            self.setCachedFileHandle({
              uri: self.fileSource.uri,
              baseUri: self.fileSource.baseUri,
              locationType: 'UriLocation',
            })
          }
          const data = await fetchAndMaybeUnzip(filehandle)
          getParent<any>(self).displaySpreadsheet({
            ...typeParser(data),
            assemblyName,
          })
        } catch (e) {
          console.error(e)
          self.setError(e)
        } finally {
          self.setLoading(false)
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        // just a one-time thing on load
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            if (self.cachedFileLocation && self.selectedAssemblyName) {
              self.setFileSource(self.cachedFileLocation)
              await self.import(self.selectedAssemblyName)
            }
          } catch (e) {
            console.error(e)
            getSession(self).notifyError(`${e}`, e)
          }
        })()
      },
    }))
}
export type ImportWizardStateModel = ReturnType<typeof stateModelFactory>
export type ImportWizardModel = Instance<ImportWizardStateModel>
