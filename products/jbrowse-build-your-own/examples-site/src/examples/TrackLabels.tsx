import { Suspense, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { useResizeDrag } from '@jbrowse/core/util/useResizeDrag'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// Pan, zoom, three kinds of track, your own status overlays, your own track
// labels, your own resize bars. Everything the browser draws is now either data
// or yours. The page after this one goes the other way, and reads a click back
// out.
//
// Nothing here draws coordinates: that is the scalebar above, and the view
// computes all of it. A column of labels beside the tracks is the other half of
// what an app usually wants around the data, and it is much less code.
//
// The labels are a plain flex row next to each track, which is the cheapest
// thing that works. JBrowse's own label layer does more (drag to reorder, a
// per-track menu, an overlap mode that floats the label over the data) and if
// you want those you should use the full component rather than rebuild them.
// Knowing where that line is for your app is the whole point of starting here.
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

const conservationTrack = {
  type: 'QuantitativeTrack',
  trackId: 'hg38_phylop',
  name: 'phyloP 100-way conservation',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
  },
  displayDefaults: {
    defaultRendering: 'xyplot',
    height: 100,
    color: '#3a7ca5',
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

const alignmentsTrack = {
  type: 'AlignmentsTrack',
  trackId: 'na12878_exome',
  name: 'NA12878 exome reads',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'CramAdapter',
    uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
  },
  displayDefaults: { height: 150 },
}

const tracks = [
  { id: 'hg38_phylop', label: 'Conservation' },
  { id: 'hg38_genes', label: 'Genes' },
  { id: 'na12878_exome', label: 'Reads' },
]
const trackIds = tracks.map(t => t.id)

const LABEL_WIDTH = 90

function makeView() {
  const state = createViewState({
    assembly: hg38,
    tracks: [conservationTrack, featureTrack, alignmentsTrack],
    init: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: trackIds,
    },
  })
  const { view } = state.session
  // see the Pan and zoom example: scroll-to-zoom is a session preference, and the
  // pileup below reads the same one to know the plain wheel is spoken for
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']

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

// Reads the display's own height so the label stays aligned when a track is
// resized or a display grows to fit its content.
const TrackLabel = observer(function TrackLabel({
  view,
  trackId,
  label,
}: {
  view: BrowserView
  trackId: string
  label: string
}) {
  const track = view.getTrack(trackId)
  if (!track) {
    return null
  }
  return (
    <div
      style={{
        height: track.activeDisplay.height,
        fontSize: '0.75rem',
        paddingRight: 8,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  )
})

const RESIZE_HANDLE_HEIGHT = 4

/**
 * Drag the bar under a track to resize it. The bar is yours (it is a divider in
 * your own row), the gesture is not: `useResizeDrag` hands back the props for a
 * pointer-capture drag reported as one distance per animation frame, which is
 * the same gesture JBrowse's own track dividers run. Spread them and style the
 * div however your app wants.
 *
 * Two model calls do the rest:
 *
 * - `display.resizeHeight(deltaPx)` is the whole resize. It clamps to the
 *   display's minimum, and it also knows what a manual drag *means*: a display
 *   in grow-to-fit mode is pinned to fixed height first, so the drag isn't
 *   immediately undone by the next relayout.
 * - `display.setResizing(true/false)` brackets the gesture. Displays whose row
 *   geometry is a function of track height restretch every row per frame, and
 *   use this to sit an expensive layer out of the drag. Skipping it costs you
 *   correctness nowhere and frames somewhere.
 *
 * `touchAction: 'none'` is yours to write here, unlike on the viewport below:
 * `usePanZoom` is handed the element as a ref and sets it itself, while this
 * hook returns props and never sees a node. Without it the browser claims a
 * touch drag as a page scroll and the pointer stream never arrives.
 */
const TrackResizeHandle = observer(function TrackResizeHandle({
  view,
  trackId,
}: {
  view: BrowserView
  trackId: string
}) {
  const display = view.getTrack(trackId)?.activeDisplay
  const handleProps = useResizeDrag({
    onDrag: distance => {
      display?.resizeHeight(distance)
    },
    onDragStart: () => {
      display?.setResizing(true)
    },
    onDragEnd: () => {
      display?.setResizing(false)
    },
  })
  return display ? (
    <div
      {...handleProps}
      aria-label={`Resize ${trackId}`}
      style={{
        height: RESIZE_HANDLE_HEIGHT,
        cursor: 'row-resize',
        touchAction: 'none',
        background: 'color-mix(in srgb, currentColor 20%, transparent)',
      }}
    />
  ) : null
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

// Still needed even with the overlays swapped: the feature and alignments
// displays read the palette for their own content colours. See the previous
// two pages.

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing, and for the one the hook writes itself.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  cursor: 'grab',
}

const TrackLabels = observer(function TrackLabels() {
  const { view, session } = useCreateOnce(makeView)
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  const mode = useSiteMode()

  return (
    <SessionPaletteProvider session={session} mode={mode}>
      <DisplayUIProvider>
        <div style={{ display: 'flex' }}>
          <div style={{ width: LABEL_WIDTH, flex: 'none' }}>
            {tracks.map(t => (
              // one spacer per resize bar, so a label stays level with its
              // track as the stack grows
              <div key={t.id}>
                <TrackLabel view={view} trackId={t.id} label={t.label} />
                <div style={{ height: RESIZE_HANDLE_HEIGHT }} />
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div ref={ref} {...containerProps} style={viewport}>
              {view.status.type === 'ready' ? (
                trackIds.map(id => (
                  <div key={id}>
                    <TrackRow view={view} trackId={id} />
                    <TrackResizeHandle view={view} trackId={id} />
                  </div>
                ))
              ) : (
                <ViewStatus view={view} />
              )}
            </div>
          </div>
        </div>
      </DisplayUIProvider>
    </SessionPaletteProvider>
  )
})

export default TrackLabels
