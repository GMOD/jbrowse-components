import { Suspense, useState } from 'react'

import { useWidthSetter } from '@jbrowse/core/util/hooks'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// The smallest thing that puts genomic data on screen: measure a div, mount one
// track's display in it. No header, no ruler, no track label, no MUI theme --
// and no `usePanZoom`, so it doesn't move. The Pan and zoom example above adds that.
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

const OneTrack = observer(function OneTrack() {
  const [view] = useState(makeView)
  // A view renders nothing until it knows its width in pixels, and it has to be
  // told again whenever that changes. This is the one piece of wiring with no
  // alternative: everything downstream (block layout, what to fetch, bpPerPx on
  // a zoom-to-fit) is derived from it. `useWidthSetter` is the hook JBrowse's
  // own views use -- it hands back a ref to put on the element to measure, and
  // reports the width a frame later, which is what keeps a ResizeObserver from
  // measuring inside its own callback.
  const ref = useWidthSetter(view)

  return (
    <div ref={ref} style={{ overflow: 'hidden' }}>
      {view.ready ? <TrackRow view={view} trackId="volvox_microarray" /> : null}
    </div>
  )
})

export default OneTrack
