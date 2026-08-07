import { Suspense, useEffect, useState } from 'react'

import {
  PaletteProvider,
  useSessionPalette,
} from '@jbrowse/core/ui/PaletteContext'
import { useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider } from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
// Vite's `?worker` suffix: it bundles the module as a worker entry point and
// hands back a constructor. Astro is a Vite app, so this is the form that works
// here. On webpack or CRA, import the package's prebuilt worker instead --
// `@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance` -- and pass that
// as `makeWorkerInstance` directly.
import RpcWorker from '@jbrowse/react-linear-genome-view2/esm/rpcWorker?worker'
import { observer } from 'mobx-react'

// Every other page on this site parses its data on the main thread. This one
// does not, and the change is one option to `createViewState`.
//
// `makeWorkerInstance` is a function returning a `Worker`. Supply it and the
// RPC layer switches to the web-worker driver on its own: no `defaultDriver`
// config, and nothing else on the page changes. The BAM below is what makes it
// worth doing -- a pileup at this depth is real BGZF inflation and real record
// parsing per pan, and on the main thread every millisecond of it is a
// millisecond your app's own UI is not repainting.
//
// The rest of the file is the earlier pages: the stack from A stack of tracks,
// the UI provider from Bring your own overlays. Self-contained, like every
// page here, so you can copy the file and run it.

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

const featureTrack = {
  type: 'FeatureTrack',
  trackId: 'volvox_genes',
  name: 'Genes',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
  },
  displayDefaults: { height: 120 },
}

const alignmentsTrack = {
  type: 'AlignmentsTrack',
  trackId: 'volvox_bam',
  name: 'Reads',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BamAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam',
  },
  displayDefaults: { height: 150 },
}

const trackIds = ['volvox_microarray', 'volvox_genes', 'volvox_bam']

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack, featureTrack, alignmentsTrack],
    // the whole of it. One worker serves the session, and every adapter's
    // fetching and parsing moves onto it.
    makeWorkerInstance: () => new RpcWorker(),
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    loc: 'ctgA:1..20,000',
    tracks: trackIds,
  })
  // see the Pan and zoom example: scroll-to-zoom is a session preference, and the
  // pileup below reads the same one to know the plain wheel is spoken for
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']

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
    <div
      ref={ref}
      {...containerProps}
      style={{
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
        cursor: 'grab',
      }}
    >
      {view.ready
        ? trackIds.map(trackId => (
            <TrackRow key={trackId} view={view} trackId={trackId} />
          ))
        : null}
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

/**
 * Follow whatever the page around this demo is themed as. All of this is the
 * *host's* half, and yours will look nothing like it -- the toggle writes an
 * attribute on <html>, the OS preference arrives as a media query, and either
 * can move without the other, so both are watched. Swap it for however your app
 * already knows it is in dark mode.
 *
 * JBrowse's half is one call, `useSessionPalette` below. It writes the config
 * slot that *both* halves of the rendering derive from -- the palette React
 * draws with, and the theme shipped to the worker that bakes feature labels
 * into the image -- and hands back the palette. Mounting `PaletteProvider`
 * alone would leave those baked labels in the old mode.
 */
function useSiteMode() {
  const [mode, setMode] = useState(readSiteMode)
  useEffect(() => {
    const update = () => {
      setMode(readSiteMode())
    }
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', update)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', update)
    }
  }, [])
  return mode
}

// JBrowse's stock displays read a palette to colour their own *content*: the
// feature display wants a highlight colour, the CDS renderer wants its reading
// frames. That is a palette of colour strings, not a UI toolkit, so it arrives
// through `PaletteProvider` and Material UI is not involved.

const RunItInAWorker = observer(function RunItInAWorker() {
  const [{ view, session }] = useState(makeView)
  const palette = useSessionPalette(session, useSiteMode())
  return (
    <PaletteProvider palette={palette}>
      <DisplayUIProvider>
        <TrackStack view={view} />
      </DisplayUIProvider>
    </PaletteProvider>
  )
})

export default RunItInAWorker
