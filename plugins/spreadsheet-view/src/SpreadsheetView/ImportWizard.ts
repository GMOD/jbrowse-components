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

// The track each file type opens as, for putting an imported file in the
// session so the views a row drills down into can show it.
//
// Deliberately NOT `guessAdapter`, which is what "Add track" uses: that guesses
// off the filename, so a `.vcf.gz` becomes a `VcfTabixAdapter` and needs an
// index beside it. The C-GIAB benchmark VCF the SV tutorial is built on has no
// `.tbi`, so a guessed track there would 404 — turning a drill-down that showed
// nothing into one that shows an error, which is worse.
//
// These plain readers take the whole file, which is exactly what the sheet
// already did to produce the rows on screen, so the track cannot fail where the
// import succeeded. A file that already has an indexed track in the session
// reaches that one instead, through `existingTrackId`.
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

// matches a file extension against the supported file types (case-insensitive)
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
 * What tells two locations apart: a resolved URL, a path, or the id of a file
 * the user handed the page. Not the filename, which two different local files
 * can share.
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

// case-insensitive match against the canonical list to handle e.g. STAR-Fusion.
//
// The query string and fragment are cut first because the extension is anchored
// to the end: a presigned URL (`.../calls.bed?X-Amz-Signature=...`) matched
// nothing, so an "open file from URL" of anything but a VCF silently kept the
// VCF default and parsed the file as the wrong format
//
// STAR-Fusion output is a `.tsv`, so its extension says nothing; the tool's own
// filenames (`star-fusion.fusion_predictions.abridged.tsv`, and the DepMap
// export spelled `K562.star-fusion.tsv`) are what name it.
const starFusionNameRegexp = /star[-_]?fusion|fusion_predictions/i

export function detectFileType(
  name: string,
): (typeof fileTypes)[number] | undefined {
  const path = name.split(/[?#]/)[0]!
  const match = fileTypesRegexp.exec(path)?.[1]?.toLowerCase()
  const byExtension = match
    ? fileTypes.find(t => t.toLowerCase() === match)
    : undefined
  return byExtension === undefined && starFusionNameRegexp.test(path)
    ? 'STAR-Fusion'
    : byExtension
}

// The header line says what the file is when the name could not: STAR-Fusion
// leads with `#FusionName`, whatever the file was renamed to.
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
       * every track in the session this view could open, with its location and
       * file type resolved, in label order.
       *
       * A getter rather than the body of tracksForAssembly so the sweep — a
       * config read per track over the whole config, plus a localeCompare
       * sort — is memoized instead of re-running on every render. TrackSelector
       * is an observer and calls this during render, and the assembly filter it
       * applies is a cheap array check on the result
       */
      get importableTracks() {
        const session = getSession(self)
        const { pluginManager } = getEnv(self)
        // not [...tracks, ...sessionTracks]: session.tracks already contains
        // sessionTracks, so that listed every session track twice
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
       * the track the session already has for the loaded file, if any.
       *
       * Matched by location rather than remembered, which answers for all three
       * ways a sheet can be holding a file: "open from track" (where it is the
       * track the reader picked), a session reloaded from
       * `cachedFileLocation` (where nothing was remembered), and a pasted URL
       * that happens to name a file some track already points at — which should
       * reach that track rather than stand up a second copy of it.
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
       * A track config for the loaded file, so the views the sheet drills down
       * into can show the records the rows came from. Undefined when the
       * session already has a track for the file — see `existingTrackId` — and
       * when the adapter declares no location key to put the file in.
       *
       * The trackId is derived from the location rather than from the view, so
       * two views importing one file share a track and a reloaded session
       * reuses the one it already has.
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
              // the basename alone as the label, which is what "Add track"
              // shows and what fits a track selector row
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
