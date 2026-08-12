import { Suspense, useState, useSyncExternalStore } from 'react'

import {
  PaletteProvider,
  useSessionPalette,
} from '@jbrowse/core/ui/PaletteContext'
import { useWidthSetter } from '@jbrowse/core/util/hooks'
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
// This file is complete. Everything it needs is either below or comes from a
// published package, so you can copy the whole thing into an app and run it.
// The other pages repeat these parts rather than importing them, for the same
// reason.

const volvox = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const wiggleTrack = {
  type: 'QuantitativeTrack',
  trackId: 'volvox_microarray',
  name: 'Microarray signal',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox_microarray.bw',
  },
  displayDefaults: {
    defaultRendering: 'xyplot',
    height: 100,
    color: '#3a7ca5',
    minScore: 0,
    maxScore: 1000,
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
 * `setInit` rather than poking `displayedRegions`/`tracks` directly: it is the
 * same declarative path a URL launch or a saved session takes, so the assembly
 * load, the navigation and the track show-ing all happen in the right order.
 *
 * No `makeWorkerInstance`, so RPC runs on the main thread. That is one fewer
 * moving piece for a demo; a real app passes a worker.
 *
 * Call it from `useState`'s lazy initializer rather than `useMemo`. React
 * guarantees a `useState` initializer runs once per mounted component, and
 * documents `useMemo` as a performance hint it is allowed to discard -- and
 * discarding this one would build a second engine and lose wherever the user
 * had panned to. Neither hook makes construction happen *only* once (StrictMode
 * runs both twice in dev, by design), so keep it to construction: a view that
 * has not been given a width yet has nothing to draw and nothing to undo.
 */
function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack],
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    loc: 'ctgA:1..50,000',
    tracks: ['volvox_microarray'],
  })
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
  // guard stays -- `view.ready` says the view can draw, not that your track is
  // instantiated yet.
  const track = view.getTrack(trackId)
  if (!track) {
    return null
  }
  const display = track.activeDisplay
  const { RenderingComponent } = display
  return (
    <div
      style={{
        position: 'relative',
        height: display.height,
        contain: 'strict',
      }}
    >
      <Suspense fallback={null}>
        <RenderingComponent
          model={display}
          onHorizontalScroll={view.horizontalScroll}
        />
      </Suspense>
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
 * JBrowse's half is one call, `useSessionPalette` below. It writes the config
 * slot that *both* halves of the rendering derive from -- the palette React
 * draws with, and the theme shipped to the worker that bakes feature labels
 * into the image -- and hands back the palette. Mounting `PaletteProvider`
 * alone would leave those baked labels in the old mode.
 */
function useSiteMode() {
  return useSyncExternalStore(
    watchSiteMode,
    readSiteMode,
    () => 'light' as const,
  )
}

const OneTrack = observer(function OneTrack() {
  const [{ view, session }] = useState(makeView)
  const palette = useSessionPalette(session, useSiteMode())
  // A view renders nothing until it knows its width in pixels, and it has to be
  // told again whenever that changes. This is the one piece of wiring with no
  // alternative: everything downstream (block layout, what to fetch, bpPerPx on
  // a zoom-to-fit) is derived from it. `useWidthSetter` is the hook JBrowse's
  // own views use -- it hands back a ref to put on the element to measure, and
  // reports the width a frame later, which is what keeps a ResizeObserver from
  // measuring inside its own callback.
  const ref = useWidthSetter(view)

  return (
    <PaletteProvider palette={palette}>
      <div ref={ref} style={{ overflow: 'hidden' }}>
        {/* `null` for the other branch is the one thing on this page that is
         * not what you should ship. `view.ready` is false in TWO states --
         * loading, and failed to load -- so this box stays empty forever if the
         * assembly 404s, with nothing anywhere saying why. Every other page
         * here draws a `ViewStatus` instead; the Loading and error states page
         * is about it. It is left out only because this page is the floor, and
         * the floor is allowed to name what it leaves out rather than have
         * it. */}
        {view.ready ? (
          <TrackRow view={view} trackId="volvox_microarray" />
        ) : null}
      </div>
    </PaletteProvider>
  )
})

export default OneTrack
