import { readConfObject } from '@jbrowse/core/configuration'
import { fetchAndMaybeUnzip, getEnv, getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'

import type { SpreadsheetSnapshot } from './SpreadsheetModel.tsx'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const IMPORT_SIZE_LIMIT = 100_000_000

export const fileTypes = ['VCF', 'BED', 'BEDPE', 'STAR-Fusion'] as const
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

function isFileLocation(loc: unknown): loc is FileLocation {
  return (
    !!loc &&
    typeof loc === 'object' &&
    ('uri' in loc ||
      'localPath' in loc ||
      'blobId' in loc ||
      'locationType' in loc)
  )
}

// maps adapter type name → spreadsheet file type; this is both the allowlist
// and the type resolution for "open from track" (avoids filename guessing)
const adapterFileTypes: Record<string, (typeof fileTypes)[number]> = {
  VcfAdapter: 'VCF',
  VcfTabixAdapter: 'VCF',
  BedAdapter: 'BED',
  BedTabixAdapter: 'BED',
  BedpeAdapter: 'BEDPE',
  StarFusionAdapter: 'STAR-Fusion',
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
  const match = fileTypesRegexp.exec(name)?.[1]?.toLowerCase()
  return match ? fileTypes.find(t => t.toLowerCase() === match) : undefined
}

/**
 * #stateModel SpreadsheetImportWizard
 * #internal import-dialog state reached only through SpreadsheetView, not an
 * API a user scripts against — kept out of the website docs
 * #category view
 */

export default function stateModelFactory() {
  return types
    .model('SpreadsheetImportWizard', {
      /**
       * #property
       */
      fileType: types.stripDefault(types.enumeration(fileTypes), 'VCF'),
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
      fileSource: undefined as FileLocation | undefined,
      /**
       * #volatile
       */

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
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
       * #method
       */
      tracksForAssembly(selectedAssembly: string) {
        const session = getSession(self)
        const { pluginManager } = getEnv(self)
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
            const rawAdapter = readConfObject(track, 'adapter')
            const adapterTypeName = rawAdapter?.type
            if (typeof adapterTypeName !== 'string') {
              return []
            }
            const fileType = adapterFileTypes[adapterTypeName]
            if (!fileType) {
              return []
            }
            const { locationKey, normalizeSnapshot } =
              pluginManager.getAdapterType(adapterTypeName)
            if (!locationKey) {
              return []
            }
            const adapter = normalizeSnapshot?.(rawAdapter) ?? rawAdapter
            const loc = adapter[locationKey]
            if (!isFileLocation(loc)) {
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
              type: fileType,
              loc,
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
       * point the source/type at the first usable track for an assembly (or
       * clear if none), used to seed the "open from track" flow
       */
      selectDefaultTrack(assembly: string) {
        const first = self.tracksForAssembly(assembly)[0]
        self.setFileSource(first?.loc)
        if (first) {
          self.setFileType(first.type)
        }
      },
      /**
       * #action
       * fetch and parse the file, returning a spreadsheet snapshot for the
       * owning view to display (the view owns displaySpreadsheet; this stays a
       * pure fetch/parse with no reach into the parent)
       */
      async import(
        assemblyName: string,
      ): Promise<SpreadsheetSnapshot | undefined> {
        let result: SpreadsheetSnapshot | undefined
        const src = self.fileSource
        // guard on isReadyToOpen, not just src existence: a source like
        // { uri: undefined } is a truthy object but has no usable location, so
        // a bare launch lands on the import form instead of feeding an empty
        // location into openLocation (which throws a spurious error)
        if (src && self.isReadyToOpen) {
          self.selectedAssemblyName = assemblyName
          const typeParser = await fileTypeParsers[self.fileType]()
          const { pluginManager } = getEnv(self)
          const filehandle = openLocation(src, pluginManager)
          self.setLoading(true)
          try {
            let stat: { size: number } | undefined
            try {
              stat = await filehandle.stat()
            } catch (e) {
              // stat failure is non-fatal; proceed without size check
              console.warn(e)
            }
            if (stat && stat.size > IMPORT_SIZE_LIMIT) {
              self.setError(
                `File is too big. Tabular files are limited to at most ${(
                  IMPORT_SIZE_LIMIT / 1000
                ).toLocaleString()}kb.`,
              )
            } else {
              if ('uri' in src) {
                self.setCachedFileHandle(src)
              }
              const data = await fetchAndMaybeUnzip(filehandle)
              result = {
                ...typeParser(data),
                assemblyName,
              }
            }
          } catch (e) {
            console.error(e)
            self.setError(e)
          } finally {
            self.setLoading(false)
          }
        }
        return result
      },
    }))
}
export type ImportWizardStateModel = ReturnType<typeof stateModelFactory>
export type ImportWizardModel = Instance<ImportWizardStateModel>
