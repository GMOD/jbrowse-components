import { Suspense, useState, useSyncExternalStore } from 'react'

import { refNameMismatchMessage } from '@jbrowse/core/assemblyManager/assembly'
import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import {
  UNKNOWN,
  UNSUPPORTED,
  guessAdapter,
  guessTrackType,
  storeBlobLocation,
} from '@jbrowse/core/util/tracks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// Open a file off the reader's own disk. No server, no upload: a `File` from an
// `<input type="file">` is registered as a blob location, and every adapter
// reads it by byte range exactly as it would a URL.
//
// This is the page with no JBrowse UI to fall back on. The managed component
// ships an "Add track" widget; a host drawing its own chrome has none, so the
// four calls it makes are yours: register the bytes, guess the adapter, guess
// the track type, put the config in the session.
//
// Two things about local files that a URL hides, both silent:
//
// - **an index is not derived from a blob.** `guessAdapter` builds a `.bai` URL
//   from a `.bam` URL by appending to it, and `makeIndex` has nothing to append
//   to on a blob, so it hands back the location it was given -- the data file as
//   its own index. So a picker takes the pair, and `pairFiles` below is that.
// - **the file's contig names have to match the genome's.** They usually don't,
//   because `1/2/3` and `chr1/chr2/chr3` are both normal, and the track then
//   draws nothing and reports nothing. `track.refNameMismatch` is JBrowse's
//   verdict on exactly that case, and the only place JBrowse itself draws it is
//   the track label -- which is chrome, so on this site it does not exist. The
//   second button opens a file that hits it.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

const hg38 = {
  name: 'hg38',
  uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
  },
}

const featureTrack = {
  type: 'FeatureTrack',
  trackId: 'hg38_genes',
  name: 'RefSeq curated genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
    csi: true,
  },
  displayDefaults: { height: 120 },
}

function makeView() {
  const state = createViewState({
    assembly: hg38,
    tracks: [featureTrack],
    init: {
      // CUZD1, so the reads the demo BAM below opens are on screen without
      // panning: that file is a real somatic-deletion slice trimmed to this
      // gene (Genome in a Bottle's HG008 tumor sample).
      loc: 'chr10:122,831,700..122,840,800',
      tracks: ['hg38_genes'],
    },
  })
  const { view } = state.session
  // see the Pan and zoom example: scroll-to-zoom is a session preference, and a
  // pileup opened below reads the same one to know the plain wheel is spoken for
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']
type BrowserSession = ReturnType<typeof makeView>['session']

// `view.status` is the view's whole lifecycle as one value, so this switches on
// it rather than re-deriving which non-ready state it is out of `error` and
// `loadingMessage`. Two of the four states are easy to leave out and both fail
// silently: a 404 on a sequence file is `error` -- a state on the model rather
// than a throw, so there is no console error either -- and a view nothing has
// navigated yet is `noRegions`, which the older `view.ready` getter reports as
// ready, so gating on that one draws an empty box that never fills. The Loading
// and error states page draws the long form of this, and has a radio that
// breaks the assembly on purpose.
const ViewStatus = observer(function ViewStatus({
  view,
}: {
  view: BrowserView
}) {
  const { status } = view
  if (status.type === 'ready') {
    return null
  }
  return (
    <div
      role={status.type === 'error' ? 'alert' : 'status'}
      style={{ padding: '10px 12px', fontSize: '0.85rem', opacity: 0.75 }}
    >
      {status.type === 'error'
        ? `Could not load: ${status.error instanceof Error ? status.error.message : String(status.error)}`
        : status.type === 'loading'
          ? status.message
          : 'Nothing to show yet'}
    </div>
  )
})

const TrackRow = observer(function TrackRow({
  view,
  trackId,
}: {
  view: BrowserView
  trackId: string
}) {
  // `view.getTrack(id)`, not a scan of `view.tracks` comparing
  // `configuration.trackId` by hand: the view keeps a map for exactly this. The
  // guard stays -- a ready `view.status` says the view can draw, not that your
  // track is instantiated yet.
  const track = view.getTrack(trackId)
  if (!track) {
    return null
  }
  const display = track.activeDisplay
  const { RenderingComponent } = display
  // `TrackOverlaySlot`, not a plain sized div. A display draws floating chrome
  // of its own -- a colour key, a corner control, the loading and error states
  // -- and `contain: strict` seals that into its own stacking context, where
  // nothing you paint over the stack can be out-z-indexed. The slot is the node
  // it portals into, mounted beside the sandbox, and it is what JBrowse's own
  // track container mounts. See the Track settings page.
  return (
    <TrackOverlaySlot zIndex={3} style={{ height: display.height }}>
      <div style={{ position: 'absolute', inset: 0, contain: 'strict' }}>
        <Suspense fallback={null}>
          <RenderingComponent
            model={display}
            onHorizontalScroll={view.horizontalScroll}
          />
        </Suspense>
      </div>
    </TrackOverlaySlot>
  )
})

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing, and for the one the hook writes itself.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  cursor: 'grab',
}

/**
 * Register one `File` and get back the location that names it.
 *
 * `storeBlobLocation` puts the file in a process-global map that
 * `openLocation` reads, and returns `{name, blobId, locationType}` pointing at
 * it. The map is memory: a blobId is meaningless to another tab, to a reload,
 * and to a session snapshot you save and restore, so a local track is a track
 * for this visit only. With an RPC worker the map is shipped across with the
 * call arguments, so nothing extra is needed there.
 *
 * The narrowing is the type system's rather than a case that happens: the
 * function accepts URIs and paths too and passes those straight through, so its
 * return type is the union, and a blob always comes back as a blob location.
 */
function blobLocation(blob: File) {
  const location = storeBlobLocation({ blob })
  if (!('blobId' in location)) {
    throw new Error(`could not register ${blob.name} as a blob location`)
  }
  return location
}

const INDEX_NAME = /\.(bai|csi|tbi|crai|fai|gzi)$/i

/**
 * Sort a picked set into data files, each with its index.
 *
 * This pairing rule is the reader's own -- it is a fact about how the files on
 * your users' disks are named, not about JBrowse -- and this one is the
 * convention every indexing tool follows: the index is the data file's name
 * plus a suffix. `x.bam` finds `x.bam.bai`, `x.vcf.gz` finds `x.vcf.gz.tbi`.
 */
function pairFiles(files: File[]) {
  const indexes = files.filter(file => INDEX_NAME.test(file.name))
  return files
    .filter(file => !INDEX_NAME.test(file.name))
    .map(data => ({
      data,
      index: indexes.find(candidate => candidate.name.startsWith(data.name)),
    }))
}

/**
 * The whole of adding a local file, and the same inference the managed
 * component's "Add track" form runs.
 *
 * `guessAdapter` matches the *name* against every format the loaded plugins
 * know and returns a whole adapter config, with the index already placed in
 * whichever field that adapter wants it in (`index.location` for a BAM,
 * `csiLocation` for a tabix file with a `.csi`). `guessTrackType` then answers
 * which track type draws that adapter. Both take an MST node so they can reach
 * the plugin manager, and it has to be a node *inside* the session -- the view
 * here -- because `getSession` starts looking at the node's parent, so handing
 * it the session itself throws.
 *
 * `addSessionTrackConf`, not `addTrackConf`: this is a track for this visitor,
 * not a catalogue entry for the whole site. A config it refuses to validate is
 * reported on `session.snackbarMessages` rather than thrown -- see the Loading
 * and error states page -- so the throw below is only for the case this
 * function can see, which is a file no plugin claims.
 *
 * The trackId comes from the blobId, which is unique per registration, so
 * picking the same file twice opens a second track rather than colliding with
 * the first.
 */
function openLocalFile({
  view,
  session,
  data,
  index,
}: {
  view: BrowserView
  session: BrowserSession
  data: File
  index?: File
}) {
  // registered once, and the blobId it comes back with is what names this
  // track: calling `blobLocation` twice would put the same bytes in the map
  // twice under two ids, and the id in the config would not be the one the
  // adapter is reading
  const dataLocation = blobLocation(data)
  const adapter = guessAdapter(
    dataLocation,
    index ? blobLocation(index) : undefined,
    undefined,
    view,
  )
  if (adapter.type === UNKNOWN || adapter.type === UNSUPPORTED) {
    throw new Error(
      `No loaded plugin reads "${data.name}". JBrowse guesses a format from the file name, so an extension it does not know is a file it cannot open.`,
    )
  }
  const trackId = `local-${dataLocation.blobId}`
  session.addSessionTrackConf({
    trackId,
    type: guessTrackType(adapter.type, view, dataLocation),
    name: data.name,
    assemblyNames: [hg38.name],
    adapter,
  })
  view.showTrack(trackId)
}

/**
 * The one diagnosis JBrowse can make from the names alone: this file and this
 * genome have *no* contig name in common, so the track can only ever be empty.
 *
 * It is set during the track's first fetch, on the assembly and keyed by the
 * adapter's cache key, and `track.refNameMismatch` is how a track reads its
 * own back. Partial overlap is deliberately not reported -- a file covering
 * some contigs is ordinary -- so this fires on a real mistake and not on a real
 * track.
 *
 * Worth drawing even if you draw nothing else here. JBrowse's own presentation
 * of it hangs off the track label, so a host drawing its own chrome shows an
 * empty track and no reason, and the commonest data mistake there is looks
 * exactly like a region with no features in it.
 */
const RefNameNotice = observer(function RefNameNotice({
  view,
}: {
  view: BrowserView
}) {
  const mismatches = view.tracks.flatMap(track =>
    track.refNameMismatch ? [track.refNameMismatch] : [],
  )
  return mismatches.length === 0 ? null : (
    <div>
      {mismatches.map(mismatch => (
        <div
          key={`${mismatch.assemblyName}-${mismatch.adapter.names.join(',')}`}
          style={notice}
        >
          {refNameMismatchMessage(mismatch)}
        </div>
      ))}
    </div>
  )
})

const notice: React.CSSProperties = {
  background: 'color-mix(in srgb, CanvasText 8%, Canvas)',
  borderLeft: '3px solid #d97706',
  padding: '6px 10px',
  fontSize: '0.8rem',
  lineHeight: 1.4,
}

const controls: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  fontSize: '0.8rem',
}

/**
 * A BAM and its index, fetched and handed over as `File` objects.
 *
 * A demo page cannot reach into your Downloads folder, so this stands in for
 * the picker beside it: past this point the two paths are the same code, and a
 * `File` is a `File` however it was made. The file itself is a real ONT
 * long-read subset trimmed to one gene, SNRPN -- the same one the methylation
 * tutorial uses -- so it is a few megabytes rather than a whole genome's worth
 * of reads.
 */
async function demoFiles() {
  const base = 'https://jbrowse.org/demos/cgiab/'
  const names = [
    'HG008-T_chr10_CUZD1_deletion.bam',
    'HG008-T_chr10_CUZD1_deletion.bam.bai',
  ]
  return Promise.all(
    names.map(async name => {
      const response = await fetch(base + name)
      if (!response.ok) {
        throw new Error(`could not fetch ${name}: ${response.status}`)
      }
      return new File([await response.arrayBuffer()], name)
    }),
  )
}

/**
 * A file from a genome that is not this one, built in the page.
 *
 * BED needs no index, so three lines of text is a complete, openable file --
 * and `2L` is a Drosophila chromosome arm name this human assembly has never
 * heard of, which is the whole point. This is the shape of the mistake: the
 * file is valid, the track loads, the fetch succeeds, and there is nothing to
 * draw.
 */
function otherGenomeFile() {
  const lines = [
    '2L\t1000\t5000\tACME1',
    '2L\t8000\t9000\tACME2',
    '2R\t2000\t6000\tACME3',
  ]
  return new File([`${lines.join('\n')}\n`], 'other-genome.bed')
}

const FilePicker = observer(function FilePicker({
  view,
  session,
}: {
  view: BrowserView
  session: BrowserSession
}) {
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)

  function open(files: File[]) {
    setError(undefined)
    try {
      for (const { data, index } of pairFiles(files)) {
        openLocalFile({ view, session, data, index })
      }
    } catch (e) {
      setError(e)
    }
  }

  return (
    <>
      <div style={controls}>
        <label>
          Open files:{' '}
          <input
            type="file"
            multiple
            style={{ font: 'inherit' }}
            onChange={event => {
              open([...(event.target.files ?? [])])
            }}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          style={{ font: 'inherit', cursor: 'pointer' }}
          onClick={() => {
            setBusy(true)
            setError(undefined)
            demoFiles()
              .then(files => {
                open(files)
              })
              .catch((e: unknown) => {
                setError(e)
              })
              .finally(() => {
                setBusy(false)
              })
          }}
        >
          {busy ? 'Fetching…' : 'Open a BAM for me'}
        </button>
        <button
          type="button"
          style={{ font: 'inherit', cursor: 'pointer' }}
          onClick={() => {
            open([otherGenomeFile()])
          }}
        >
          Open a file from another genome
        </button>
      </div>
      {error ? (
        <div role="alert" style={notice}>
          {error instanceof Error ? error.message : String(error)}
        </div>
      ) : null}
      <RefNameNotice view={view} />
    </>
  )
})

/**
 * The column, in `view.tracks` order -- which here is the order the files were
 * opened, since `showTrack` appends and nothing on this page hides one.
 *
 * The selector page derives its order from the catalogue instead, because a
 * checkbox that can be unticked and reticked makes `view.tracks` order
 * something the user shuffles by accident. Appending only is what makes this
 * the simpler of the two.
 */
const TrackColumn = observer(function TrackColumn({
  view,
}: {
  view: BrowserView
}) {
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  return (
    <div ref={ref} {...containerProps} style={viewport}>
      {view.status.type === 'ready' ? (
        view.tracks.map(track => (
          <TrackRow
            key={track.configuration.trackId}
            view={view}
            trackId={track.configuration.trackId}
          />
        ))
      ) : (
        <ViewStatus view={view} />
      )}
    </div>
  )
})

// A display paints no background of its own -- its labels are drawn straight
// onto whatever is behind them, so light-theme text on a dark page is near-black
// on near-black. This is the page's own answer to "which mode am I in".
function readSiteMode(): 'light' | 'dark' {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') {
    return chosen
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

// The two places that answer can change from. The site's toggle writes an
// attribute on <html> and the OS preference arrives as a media query, and
// either can move without the other, so both are watched.
function watchSiteMode(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    media.removeEventListener('change', onChange)
  }
}

/**
 * Follow whatever the page around this demo is themed as. All of this is the
 * *host's* half, and yours will look nothing like it -- swap it for however
 * your app already knows it is in dark mode.
 *
 * `useSyncExternalStore`, not `useState` + `useEffect`: the mode lives outside
 * React, so this reads it *during* render rather than publishing one value and
 * correcting it a paint later. The third argument is the server snapshot, for
 * a reader pasting this into a framework that prerenders.
 *
 * JBrowse's half is one mount, `SessionPaletteProvider` below. It writes the
 * config slot that *both* halves of the rendering derive from -- the palette
 * React draws with, and the theme shipped to the worker that bakes feature
 * labels into the image. `PaletteProvider` on its own is the near miss: it
 * colours React and leaves those baked labels in the old mode.
 */
function useSiteMode() {
  return useSyncExternalStore(
    watchSiteMode,
    readSiteMode,
    () => 'light' as const,
  )
}

const OpenALocalFile = observer(function OpenALocalFile() {
  const { view, session } = useCreateOnce(makeView)
  const mode = useSiteMode()

  return (
    <SessionPaletteProvider session={session} mode={mode}>
      <DisplayUIProvider>
        <FilePicker view={view} session={session} />
        <TrackColumn view={view} />
      </DisplayUIProvider>
    </SessionPaletteProvider>
  )
})

export default OpenALocalFile
