import { readConfObject } from '@jbrowse/core/configuration'
import { getEnv, getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getParent, types } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const IMPORT_SIZE_LIMIT = 100_000_000

const fileTypes = ['VCF', 'BED', 'BEDPE', 'STAR-Fusion'] as const
const fileTypeParsers = {
  VCF: () =>
    import('./importAdapters/VcfImport.ts').then(r => r.parseVcfBuffer),
  BED: () =>
    import('./importAdapters/BedImport.ts').then(r => r.parseBedBuffer),
  BEDPE: () =>
    import('./importAdapters/BedpeImport.ts').then(r => r.parseBedPEBuffer),
  'STAR-Fusion': () =>
    import('./importAdapters/STARFusionImport.ts').then(
      r => r.parseSTARFusionBuffer,
    ),
}

const adapterTypeMap: Record<
  string,
  { fileType: string; locationKey: string }
> = {
  VcfAdapter: { fileType: 'VCF', locationKey: 'vcfLocation' },
  VcfTabixAdapter: { fileType: 'VCF', locationKey: 'vcfGzLocation' },
  BedAdapter: { fileType: 'BED', locationKey: 'bedLocation' },
  BedTabixAdapter: { fileType: 'BED', locationKey: 'bedGzLocation' },
  BedpeAdapter: { fileType: 'BEDPE', locationKey: 'bedpeLocation' },
}

function isFileLocation(loc: unknown): loc is FileLocation {
  return !!loc && typeof loc === 'object' && 'locationType' in loc
}

function getAdapterInfo(adapter: Record<string, unknown>) {
  const { type } = adapter
  if (typeof type !== 'string') {
    return undefined
  }
  const entry = adapterTypeMap[type]
  if (!entry) {
    return undefined
  }
  const rawLoc = adapter[entry.locationKey] ?? adapter
  return isFileLocation(rawLoc)
    ? { fileType: entry.fileType, loc: rawLoc }
    : undefined
}

// matches a file extension against the supported file types (case-insensitive)
const fileTypesRegexp = new RegExp(
  String.raw`\.(${fileTypes.join('|')})(\.gz)?$`,
  'i',
)

export function getFileSourceName(src: FileLocation): string | undefined {
  return 'uri' in src
    ? src.uri
    : 'localPath' in src
      ? src.localPath
      : 'blobId' in src
        ? src.name
        : undefined
}

// case-insensitive match against the canonical list to handle e.g. STAR-Fusion
export function detectFileType(
  name: string,
): (typeof fileTypes)[number] | undefined {
  const match = fileTypesRegexp.exec(name)?.[1]
  return match
    ? fileTypes.find(t => t.toLowerCase() === match.toLowerCase())
    : undefined
}

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
      fileSource: undefined as FileLocation | undefined,
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
        const src = self.fileSource
        return !!(
          src &&
          (('blobId' in src && src.blobId) ||
            ('localPath' in src && src.localPath) ||
            ('uri' in src && src.uri))
        )
      },

      /**
       * #getter
       */
      get fileName() {
        return self.fileSource ? getFileSourceName(self.fileSource) : undefined
      },

      /**
       * #getter
       */
      get requiresUnzip() {
        const name = this.fileName
        return typeof name === 'string' && name.endsWith('gz')
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
      setFileSource(newSource: FileLocation | undefined) {
        self.fileSource = newSource
        self.error = undefined

        const name = self.fileName
        const detected = name ? detectFileType(name) : undefined
        if (detected) {
          self.fileType = detected
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
        const valid = fileTypes.find(t => t === typeName)
        if (valid) {
          self.fileType = valid
        }
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
        const typeParser = await fileTypeParsers[self.fileType]()

        const { fetchAndMaybeUnzip } = await import('@jbrowse/core/util')
        const { pluginManager } = getEnv(self)
        const filehandle = openLocation(self.fileSource, pluginManager)
        self.setLoading(true)
        try {
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
          }

          if ('uri' in self.fileSource) {
            self.setCachedFileHandle(self.fileSource)
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
