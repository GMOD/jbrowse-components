import {
  fetchAndMaybeUnzip,
  getEnv,
  getSession,
  isBlobLocation,
  isFileHandleLocation,
  isLocalPathLocation,
  isUriLocation,
  resolveUri,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  allSessionTracks,
  getConfAssemblyNamesOrNone,
  getFileName,
  getTrackName,
  toTrackConfigEntry,
} from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'

import type { SpreadsheetSnapshot } from './SpreadsheetModel.tsx'
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
    isUriLocation(loc) ||
    isLocalPathLocation(loc) ||
    isBlobLocation(loc) ||
    isFileHandleLocation(loc)
  )
}

// the adapters "open from track" accepts, and the file type each reads
const adapterFileTypes: Record<string, (typeof fileTypes)[number]> = {
  VcfAdapter: 'VCF',
  VcfTabixAdapter: 'VCF',
  BedAdapter: 'BED',
  BedTabixAdapter: 'BED',
  BedpeAdapter: 'BEDPE',
  StarFusionAdapter: 'STAR-Fusion',
}

// The track an imported file becomes. Not `guessAdapter`, which makes a
// `.vcf.gz` a tabix track that 404s without an index: these whole-file readers
// cannot fail where the import succeeded.
const fileTypeTracks: Record<
  (typeof fileTypes)[number],
  { trackType: string; adapterType: string }
> = {
  VCF: { trackType: 'VariantTrack', adapterType: 'VcfAdapter' },
  BED: { trackType: 'FeatureTrack', adapterType: 'BedAdapter' },
  BEDPE: { trackType: 'VariantTrack', adapterType: 'BedpeAdapter' },
  'STAR-Fusion': {
    trackType: 'VariantTrack',
    adapterType: 'StarFusionAdapter',
  },
}

const fileTypesRegexp = new RegExp(
  String.raw`\.(${fileTypes.join('|')})(\.gz)?$`,
  'i',
)

export function getFileSourceName(src: FileLocation): string | undefined {
  return isUriLocation(src)
    ? src.uri
    : isLocalPathLocation(src)
      ? src.localPath
      : isBlobLocation(src) || isFileHandleLocation(src)
        ? src.name
        : undefined
}

/**
 * A key for a location: its resolved URL, its path, or the id of a file the
 * user handed the page. The filename would not do, since two local files can
 * share one.
 */
export function fileSourceIdentity(src: FileLocation): string | undefined {
  return isUriLocation(src)
    ? resolveUri(src)
    : isLocalPathLocation(src)
      ? src.localPath
      : isBlobLocation(src)
        ? `blob:${src.blobId}`
        : isFileHandleLocation(src)
          ? `handle:${src.handleId}`
          : undefined
}

// a location a later session load can read again without the user's help
function isReloadable(src: FileLocation) {
  return isUriLocation(src) || isLocalPathLocation(src)
}

// STAR-Fusion writes a `.tsv`, so only the tool's filenames identify it
const starFusionNameRegexp = /star[-_]?fusion|fusion_predictions/i

export function detectFileType(
  name: string,
): (typeof fileTypes)[number] | undefined {
  // a presigned URL's query would hide the extension
  const path = name.split(/[?#]/)[0]!
  const match = fileTypesRegexp.exec(path)?.[1]?.toLowerCase()
  const byExtension = match
    ? fileTypes.find(t => t.toLowerCase() === match)
    : undefined
  return byExtension === undefined && starFusionNameRegexp.test(path)
    ? 'STAR-Fusion'
    : byExtension
}

// STAR-Fusion's header starts `#FusionName` whatever the file is called
export function sniffFileType(
  data: Uint8Array,
): (typeof fileTypes)[number] | undefined {
  const head = new TextDecoder().decode(data.subarray(0, 4096))
  const firstLine = head.split('\n')[0]!
  return /^#?FusionName\t/.test(firstLine) ? 'STAR-Fusion' : undefined
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
       * the loaded file, when it is a URL or a local path a reloaded session
       * can read again; the snapshot then omits the rows
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
        return !!self.fileSource && !!fileSourceIdentity(self.fileSource)
      },

      /**
       * #getter
       */
      get fileName() {
        return self.fileSource ? getFileSourceName(self.fileSource) : undefined
      },

      /**
       * #getter
       * every session track this view could open, with its location and file
       * type, in label order
       */
      get importableTracks() {
        const session = getSession(self)
        const { pluginManager } = getEnv(self)
        return allSessionTracks(session)
          .flatMap(track => {
            const entry = toTrackConfigEntry(track)
            const assemblyNames = getConfAssemblyNamesOrNone(track)
            const rawAdapter = (entry.adapter ?? {}) as Record<string, unknown>
            const adapterTypeName = rawAdapter.type
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
            const category = (entry.category as string[] | undefined) ?? []
            const categoryStr = category.join(',')
            return {
              track,
              assemblyNames,
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
      /**
       * #method
       */
      tracksForAssembly(selectedAssembly: string) {
        return this.importableTracks.filter(t =>
          t.assemblyNames.includes(selectedAssembly),
        )
      },

      /**
       * #getter
       * the session's track for the loaded file, matched by location, so a
       * picked track, a reloaded session and a pasted URL all find it
       */
      get existingTrackId() {
        const loc = self.fileSource ?? self.cachedFileLocation
        const identity = loc ? fileSourceIdentity(loc) : undefined
        return identity
          ? this.importableTracks.find(
              t => fileSourceIdentity(t.loc) === identity,
            )?.track.trackId
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #method
       * a track config for the loaded file, or undefined when the session
       * already has one. The trackId comes from the location, so two views
       * importing one file share it
       */
      trackConfForImportedFile(assemblyName: string) {
        const loc = self.fileSource ?? self.cachedFileLocation
        const identity = loc ? fileSourceIdentity(loc) : undefined
        if (!loc || !identity || self.existingTrackId) {
          return undefined
        }
        const { trackType, adapterType } = fileTypeTracks[self.fileType]
        const { pluginManager } = getEnv(self)
        const { locationKey } = pluginManager.getAdapterType(adapterType)
        return locationKey
          ? {
              type: trackType,
              trackId: `spreadsheet-import-${identity}`,
              name: getFileName(loc),
              assemblyNames: [assemblyName],
              adapter: { type: adapterType, [locationKey]: loc },
            }
          : undefined
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
          self.error = undefined
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
      setCachedFileLocation(arg?: FileLocation) {
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
        const src = self.fileSource
        if (!src || !self.isReadyToOpen) {
          return undefined
        }
        self.selectedAssemblyName = assemblyName
        self.error = undefined
        // before the fetch, so a snapshot taken mid-load can still reload it
        self.setCachedFileLocation(isReloadable(src) ? src : undefined)
        self.setLoading(true)
        try {
          // the user can close the view during any await, and MST only warns
          // about a write to a dead node, so check after each one
          const data = await fetchAndMaybeUnzip(
            openLocation(src, getEnv(self).pluginManager),
          )
          if (!isAlive(self)) {
            return undefined
          }
          if (data.length > IMPORT_SIZE_LIMIT) {
            self.setError(
              `File is too big. Tabular files are limited to at most ${
                IMPORT_SIZE_LIMIT / 1_000_000
              }MB.`,
            )
            return undefined
          }
          const sniffed = sniffFileType(data)
          if (sniffed !== undefined) {
            self.setFileType(sniffed)
          }
          const typeParser = await fileTypeParsers[self.fileType]()
          return isAlive(self)
            ? { ...typeParser(data), assemblyName }
            : undefined
        } catch (e) {
          console.error(e)
          if (isAlive(self)) {
            self.setError(e)
          }
          return undefined
        } finally {
          if (isAlive(self)) {
            self.setLoading(false)
          }
        }
      },
    }))
}
export type ImportWizardStateModel = ReturnType<typeof stateModelFactory>
export type ImportWizardModel = Instance<ImportWizardStateModel>
