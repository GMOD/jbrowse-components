import { Suspense, useEffect, useRef, useState } from 'react'

import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// The smallest thing that puts genomic data on screen: measure a div, mount one
// track's display in it. No header, no ruler, no track label, no MUI theme --
// and none of the wheel/pointer wiring the Pan and zoom page adds, either.
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
  return view
}

type BrowserView = ReturnType<typeof makeView>

/**
 * A view renders nothing until it knows its width in pixels, and it needs to be
 * told again whenever that changes. This is the one piece of wiring with no
 * alternative: everything downstream (block layout, what to fetch, bpPerPx on a
 * zoom-to-fit) is derived from it.
 */
function useViewWidth(view: BrowserView) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w > 0) {
        view.setWidth(w)
      }
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [view])
  return ref
}

/**
 * Is there anything to draw yet?
 *
 * The obvious gate is `view.initialized`, and on its own it is the wrong one.
 * That getter answers "have the assembly's regions loaded", which is only the
 * first of two async steps: navigating (what `setInit` above asks for) then
 * populates `displayedRegions`, and in the window between the two `initialized`
 * is already true while there is still nothing on screen. Mount a display into
 * that window and its `pxToBp`/block reads run against no regions.
 *
 * `showLoading` is the view's own composite of both halves -- it folds in
 * `initPending`, the getter that exists for exactly that gap -- and it is what
 * JBrowse's own `LinearGenomeView` component branches on. Read it rather than
 * reassembling the condition, and it stays correct if the sequencing changes.
 *
 * `error` is the third outcome: a failed assembly load also ends the loading
 * state, so a bare `!showLoading` would mount over the wreckage. These examples
 * just draw nothing; a real app renders `view.error` here.
 */
function isViewReady(view: BrowserView) {
  return !view.showLoading && !view.error
}

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
  const track = view.tracks.find(t => t.configuration.trackId === trackId)
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

const OneTrack = observer(function OneTrack() {
  const [view] = useState(makeView)
  const ref = useViewWidth(view)

  return (
    <div ref={ref} style={{ overflow: 'hidden' }}>
      {isViewReady(view) ? (
        <TrackRow view={view} trackId="volvox_microarray" />
      ) : null}
    </div>
  )
})

export default OneTrack
