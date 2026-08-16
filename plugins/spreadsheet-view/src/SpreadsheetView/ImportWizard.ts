import { readConfObject } from '@jbrowse/core/configuration'
import { fetchAndMaybeUnzip, getEnv, getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  allSessionTracks,
  getFileName,
  getTrackName,
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
  return 'uri' in src
    ? src.uri
    : 'localPath' in src
      ? src.localPath
      : 'blobId' in src
        ? src.name
        : undefined
}

// case-insensitive match against the canonical list to handle e.g. STAR-Fusion.
//
// The query string and fragment are cut first because the extension is anchored
// to the end: a presigned URL (`.../calls.bed?X-Amz-Signature=...`) matched
// nothing, so an "open file from URL" of anything but a VCF silently kept the
// VCF default and parsed the file as the wrong format
export function detectFileType(
  name: string,
): (typeof fileTypes)[number] | undefined {
  const path = name.split(/[?#]/)[0]!
  const match = fileTypesRegexp.exec(path)?.[1]?.toLowerCase()
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
       * #getter
       * every track in the session this view could open, with its location and
       * file type resolved, in label order.
       *
       * A getter rather than the body of tracksForAssembly so the sweep — a
       * readConfObject per track over the whole config, plus a localeCompare
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
            const assemblyNames: string[] =
              readConfObject(track, 'assemblyNames') ?? []
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
        const name = loc ? getFileSourceName(loc) : undefined
        return name
          ? this.importableTracks.find(t => getFileSourceName(t.loc) === name)
              ?.track.trackId
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
        const name = loc ? getFileSourceName(loc) : undefined
        if (!loc || !name || self.existingTrackId) {
          return undefined
        }
        const { trackType, adapterType } = fileTypeTracks[self.fileType]
        const { pluginManager } = getEnv(self)
        const { locationKey } = pluginManager.getAdapterType(adapterType)
        return locationKey
          ? {
              type: trackType,
              // the whole location in the id, so two files with one basename
              // cannot collide; the basename alone as the label, which is what
              // "Add track" shows and what fits a track selector row
              trackId: `spreadsheet-import-${name}`,
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
        let result: SpreadsheetSnapshot | undefined
        const src = self.fileSource
        // guard on isReadyToOpen, not just src existence: a source like
        // { uri: undefined } is a truthy object but has no usable location, so
        // a bare launch lands on the import form instead of feeding an empty
        // location into openLocation (which throws a spurious error)
        if (src && self.isReadyToOpen) {
          self.selectedAssemblyName = assemblyName
          // Before the parser await, not after. That await is a lazy chunk
          // fetch over the network and the user has already pressed Open, so
          // set afterwards it left the whole fetch un-narrated: no spinner in
          // the wizard, and `showLoading` (and so the view's
          // `data-view-phase`) still reporting ready over a view that is
          // plainly working. `openLocation` moved inside the try along with it,
          // both so a throw there can't strand `loading` at true and so a bad
          // location reports in the wizard's own error banner like every other
          // import failure, rather than as a snackbar from loadSpreadsheet.
          self.setLoading(true)
          try {
            const typeParser = await fileTypeParsers[self.fileType]()
            // every await here is a place the user can close the view, and
            // every write past one lands on a node MST has torn down. Under the
            // default livelinessChecking that does not throw — it logs three
            // warnings and drops the write — so the cost is a console full of
            // them plus a whole file fetched and parsed for a view that is gone
            if (!isAlive(self)) {
              return undefined
            }
            const { pluginManager } = getEnv(self)
            const filehandle = openLocation(src, pluginManager)
            let stat: { size: number } | undefined
            try {
              stat = await filehandle.stat()
            } catch (e) {
              // stat failure is non-fatal; proceed without size check
              console.warn(e)
            }
            // and again after the stat, which is the first round trip that can
            // take long enough for the user to close the view
            if (!isAlive(self)) {
              return undefined
            }
            if (stat && stat.size > IMPORT_SIZE_LIMIT) {
              self.setError(
                `File is too big. Tabular files are limited to at most ${
                  IMPORT_SIZE_LIMIT / 1_000_000
                }MB.`,
              )
            } else {
              if ('uri' in src) {
                self.setCachedFileLocation(src)
              }
              const data = await fetchAndMaybeUnzip(filehandle)
              result = {
                ...typeParser(data),
                assemblyName,
              }
            }
          } catch (e) {
            console.error(e)
            if (isAlive(self)) {
              self.setError(e)
            }
          } finally {
            if (isAlive(self)) {
              self.setLoading(false)
            }
          }
        }
        return result
      },
    }))
}
export type ImportWizardStateModel = ReturnType<typeof stateModelFactory>
export type ImportWizardModel = Instance<ImportWizardStateModel>
