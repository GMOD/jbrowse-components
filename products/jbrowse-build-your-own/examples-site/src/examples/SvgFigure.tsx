import { Suspense, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import { useViewSvgFigure } from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// The same components JBrowse's "Export SVG" is built from, mounted in the page
// as ordinary React rather than serialized to a file. The canvas browser is on
// top; below it is a figure of the same view, in SVG, in the same document --
// every glyph a DOM node, every gene name selectable text.
//
// `useViewSvgFigure` is the whole of it. What it is doing that a hand-rolled
// version would not:
//
// - a display's `renderSvg` is async and returns a ReactNode, so something has
//   to await it, discard a render the next pan overtook, and hold the result.
// - the ruler, the scalebar and the region seams re-read the model on any React
//   render, while the track bodies are frozen at the moment they were built. The
//   hook renders them as one memoized unit so a host re-rendering (this page
//   draws a position readout, which re-renders on every pan frame) cannot slide
//   one half off the other.
// - the header band, the label gutter, the legend gutter and the 50px export
//   margin are geometry, and a figure that reserves the last one wrong clips the
//   wiggle's y-axis, which is drawn left of zero.
//
// It redraws when the view *settles* -- the same 500ms-coarse signal the
// displays refetch on -- because a redraw builds a few thousand DOM nodes, and
// that is the honest trade this page is about: the canvas above is what pans at
// 60fps.
//
// The band over BRCA1 is `view.highlight`, which the figure draws for you: it is
// part of what a figure is a picture of, so it is in the hook's redraw key and a
// band added under a drawn figure makes a new one. It appears only in the figure
// here because the canvas half of this page mounts no overlay of its own -- the
// Highlight a region page is the one that draws bands on the canvas side.
//
// Self-contained, like every page here: the engine, mounting and dark-mode parts
// introduced on earlier pages are repeated rather than imported.

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

const trackIds = ['hg38_phylop', 'hg38_genes']

// The gene, in a window with room either side of it, so the highlight below
// reads as a band over something rather than as a tint over the whole figure.
const brca1 = {
  assemblyName: 'hg38',
  refName: 'chr17',
  start: 43044295,
  end: 43125364,
  label: 'BRCA1',
}

function makeView() {
  const state = createViewState({
    assembly: hg38,
    tracks: [conservationTrack, featureTrack],
    init: {
      loc: 'chr17:43,000,000..43,170,000',
      tracks: trackIds,
      // an `init` entry rather than a `view.highlight` write after the fact,
      // for the reason `loc` is one: the view resolves both once it has an
      // assembly, so nothing here has to wait for that
      highlight: [brca1],
    },
  })
  const { view } = state.session
  // see the Pan and zoom example: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']

/**
 * The figure, plus the caption that says what it is a picture of.
 *
 * Everything above the caption line is the hook's; everything in it is this
 * page's own. `skipped` is the one to copy rather than leave out: a display type
 * that implements no `renderSvg` is dropped from the figure rather than failing
 * it, so a figure can be quietly one track short and nothing in the file says
 * so. JBrowse's own exports report that through `session.snackbarMessages`,
 * which a host drawing its own chrome renders nowhere -- see the Loading and
 * error states page.
 *
 * `height` is the size of the figure being drawn *or the last one*, so the box
 * keeps its height between redraws instead of letting the prose below it walk up
 * the page.
 */
const SvgFigurePanel = observer(function SvgFigurePanel({
  view,
}: {
  view: BrowserView
}) {
  const { figure, height, locstring, skipped, error, isLoading } =
    useViewSvgFigure(view)
  return (
    <div>
      <div style={{ fontSize: '0.8rem', opacity: 0.7, padding: '6px 0' }}>
        {error
          ? `Could not draw the figure: ${error instanceof Error ? error.message : String(error)}`
          : locstring
            ? [
                `SVG of ${locstring}`,
                skipped.length > 0
                  ? `no SVG renderer for ${skipped.join(', ')}`
                  : undefined,
              ]
                .filter(Boolean)
                .join(' — ')
            : isLoading
              ? 'Drawing'
              : 'Nothing to draw'}
      </div>
      <div style={{ minHeight: height }}>{figure}</div>
    </div>
  )
})

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
 * The parts above, composed: a measured, pan/zoomable column of tracks and
 * nothing else. This is the smallest thing that is recognisably a genome
 * browser.
 */
const TrackStack = observer(function TrackStack({
  view,
}: {
  view: BrowserView
}) {
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  return (
    <div ref={ref} {...containerProps} style={viewport}>
      {view.status.type === 'ready' ? (
        trackIds.map(trackId => (
          <TrackRow key={trackId} view={view} trackId={trackId} />
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

const SvgFigure = observer(function SvgFigure() {
  const { view, session } = useCreateOnce(makeView)
  const mode = useSiteMode()
  return (
    <SessionPaletteProvider session={session} mode={mode}>
      {/* both bring-your-own seams at once, defaulting to the plain sets: no
       * argument means no Material UI in the canvas browser's status states or
       * corner controls. The Removing Material UI page writes them by hand. The
       * figure below needs no equivalent -- an SVG body draws no chrome, and the
       * one thing it does draw that a display would (a colour key) is vector. */}
      <DisplayUIProvider>
        <TrackStack view={view} />
      </DisplayUIProvider>
      <SvgFigurePanel view={view} />
    </SessionPaletteProvider>
  )
})

export default SvgFigure
