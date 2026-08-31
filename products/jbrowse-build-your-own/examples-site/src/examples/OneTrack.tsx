import { Suspense, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { TrackOverlaySlot } from '@jbrowse/display-ui'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// The smallest thing that puts genomic data on screen: measure a div, mount one
// track's display in it. No header, no ruler, no track label, no MUI theme --
// no status states either, which is the one omission worth knowing about before
// you copy this (see the gate at the bottom) -- and no `usePanZoom`, so it
// doesn't move. The Pan and zoom example above adds that.
//
// The palette at the bottom is NOT one of the things the floor leaves out, and
// it is the one piece of this that is easy to mistake for optional. A wiggle
// track draws its own y-axis, in React, from `usePalette()` -- and with no
// provider that hook falls back to JBrowse's *light* default whatever the page
// around it is, so the axis line and its numbers come out light-themed on a
// dark host. Nothing errors and the canvas beside them is right, which is what
// makes it hard to spot.
//
// `TrackOverlaySlot` in `TrackRow` is the other one, and it fails the same way.
// A display floats chrome of its own out of a `contain: strict` box, and the
// slot is the node it escapes into. This page paints nothing over its track, so
// leaving the slot out would look identical here and break the first time you
// drew a seam, a band or a scalebar over the stack -- which is what every page
// after this one does.
//
// This file is complete. Everything it needs is either below or comes from a
// published package, so you can copy the whole thing into an app and run it.
// The other pages repeat these parts rather than importing them, for the same
// reason.

const hg38 = {
  name: 'hg38',
  uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
  },
}

// An id and a file: `.bw` picks the adapter and the track type, the one
// assembly above is the one it sits on, and a key beside `uri` wins over the
// guess. The doc below shows the same track written out.
const conservationTrack = {
  trackId: 'hg38_phylop',
  name: 'phyloP 100-way conservation',
  uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
  displayDefaults: {
    defaultRendering: 'xyplot',
    height: 100,
    color: '#3a7ca5',
  },
}

/**
 * The engine half of a genome browser: assemblies, adapters, the RPC layer, the
 * fetch/render lifecycle, and the MST state tree that ties them together. None
 * of that is what makes a browser *look* like a browser, and none of it is what
 * these examples rebuild -- `createViewState` hands it all over in one call.
 *
 * What it does NOT give you is chrome (the UI drawn around the data -- ruler,
 * track labels, status overlays). `state.session.view` knows `bpPerPx`,
 * `offsetPx`, `displayedRegions` and how to `zoomTo`/`horizontalScroll`, but it
 * draws nothing. Rendering it is the part you own.
 *
 * `init` rather than poking `displayedRegions`/`tracks` directly: it is the
 * same declarative path a URL launch or a saved session takes, so the assembly
 * load, the navigation and the track show-ing all happen in the right order.
 * The view's own `setLaunch` takes the same blob if you need to re-launch one
 * later; passing it here fills in `assembly` from the option above, so the
 * genome is named once and the two cannot drift apart.
 *
 * No `makeWorkerInstance`, so RPC runs on the main thread. That is one fewer
 * moving piece for a demo; a real app passes a worker.
 *
 * **Call it from `useCreateOnce`, not from `useState`'s lazy initializer.**
 * React double-invokes a state initializer under StrictMode -- which is on in
 * most app templates -- and throws the SECOND result away. For an ordinary
 * value that is the intended lint; for an engine it stands up a second MST
 * tree, a second set of autoruns and a second worker pool, drops the only
 * reference to it, and leaves it fetching with nothing left that could destroy
 * it. Nothing errors, because the one React kept behaves perfectly.
 * `useCreateOnce` is a ref written once, which survives the double render.
 * (`useMemo` is worse again: React documents it as a hint it may discard, and
 * discarding this one would lose wherever the user had panned to.)
 */
function makeView() {
  const state = createViewState({
    assembly: hg38,
    tracks: [conservationTrack],
    init: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['hg38_phylop'],
    },
  })
  const { view } = state.session
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']

/**
 * One track. `activeDisplay` is the model that actually draws, and
 * `RenderingComponent` is its React component -- for a wiggle track that is the
 * canvas plus its y-axis, for alignments the pileup plus its scrollbar.
 *
 * The wrapper only supplies height and a positioning context. `contain: strict`
 * clips the display to its box, which matters because displays draw overlays
 * absolutely and would otherwise paint over their neighbours.
 *
 * Suspense because `RenderingComponent` is lazy in every plugin.
 */
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

const OneTrack = observer(function OneTrack() {
  const { view, session } = useCreateOnce(makeView)
  const mode = useSiteMode()
  // A view renders nothing until it knows its width in pixels, and it has to be
  // told again whenever that changes. This is the one piece of wiring with no
  // alternative: everything downstream (block layout, what to fetch, bpPerPx on
  // a zoom-to-fit) is derived from it. `useWidthSetter` is the hook JBrowse's
  // own views use -- it hands back a ref to put on the element to measure, and
  // reports the width a frame later, which is what keeps a ResizeObserver from
  // measuring inside its own callback.
  const ref = useWidthSetter(view)

  return (
    <SessionPaletteProvider session={session} mode={mode}>
      <div ref={ref} style={{ overflow: 'hidden' }}>
        {/* `null` for the other branch is the one thing on this page that is
         * not what you should ship. `view.status.type` has four values and this
         * draws one of them, so an assembly that 404s leaves this box empty
         * forever with nothing anywhere saying why -- the failure is a state on
         * the model rather than a throw, so there is no console error either.
         * Every other page here draws a `ViewStatus` over the other three; the
         * Loading and error states page is about them. It is left out only
         * because this page is the floor, and the floor is allowed to name what
         * it leaves out rather than have it. */}
        {view.status.type === 'ready' ? (
          <TrackRow view={view} trackId="hg38_phylop" />
        ) : null}
      </div>
    </SessionPaletteProvider>
  )
})

export default OneTrack
