import { Suspense, useEffect, useRef, useState } from 'react'

import {
  PaletteProvider,
  useSessionPalette,
} from '@jbrowse/core/ui/PaletteContext'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'
import { useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import {
  DisplayChromeOverlayProvider,
  TrackControlProvider,
  plainChromeOverlays,
  plainTrackControl,
} from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// Pan, zoom, three kinds of track, your own status overlays, your own ruler,
// your own track labels. Everything the browser draws is now either data or
// yours. The page after this one goes the other way, and reads a click back out.
//
// The labels are a plain flex row next to each track, which is the cheapest
// thing that works. JBrowse's own label layer does more (drag to reorder, a
// per-track menu, an overlap mode that floats the label over the data) and if
// you want those you should use the full component rather than rebuild them.
// Knowing where that line is for your app is the whole point of starting here.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

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

const tracks = [
  { id: 'volvox_microarray', label: 'Microarray' },
  { id: 'volvox_genes', label: 'Genes' },
  { id: 'volvox_bam', label: 'Reads' },
]
const trackIds = tracks.map(t => t.id)

const LABEL_WIDTH = 90
const RULER_HEIGHT = 22

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack, featureTrack, alignmentsTrack],
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    loc: 'ctgA:1..20,000',
    tracks: trackIds,
  })
  // see the Pan and zoom page: scroll-to-zoom is a session preference, and the
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

// A coordinate ruler, written against the same view model the tracks use. This
// is chrome (UI drawn around the data, as opposed to the engine underneath it):
// nothing needs it, and that is the point of putting it on its own page. You
// add the pieces your app wants and skip the rest.
//
// The maths is two view methods. `dynamicBlocks.contentBlocks` is exactly what
// is on screen right now (one entry per contiguous region, so a discontinuous
// view gives several), and `bpToPx` turns a genomic coordinate into a pixel
// offset. `chooseGridPitch` is a core helper that picks a round tick spacing
// for the current zoom, so labels stay legible instead of colliding.
const Ruler = observer(function Ruler({ view }: { view: BrowserView }) {
  if (!view.ready) {
    return <div style={{ height: RULER_HEIGHT }} />
  }
  const { majorPitch } = chooseGridPitch(view.bpPerPx, 100, 15)

  return (
    <div
      style={{
        position: 'relative',
        height: RULER_HEIGHT,
        overflow: 'hidden',
        borderBottom: '1px solid',
        borderColor: 'color-mix(in srgb, currentColor 25%, transparent)',
        fontSize: '0.7rem',
        userSelect: 'none',
      }}
    >
      {view.dynamicBlocks.contentBlocks.flatMap(block => {
        const first = Math.ceil(block.start / majorPitch) * majorPitch
        const ticks = []
        for (let bp = first; bp < block.end; bp += majorPitch) {
          const px = view.bpToPx({ refName: block.refName, coord: bp })
          if (px) {
            ticks.push(
              <span
                key={`${block.key}-${bp}`}
                style={{
                  position: 'absolute',
                  left: px.offsetPx - view.offsetPx,
                  top: 0,
                  paddingLeft: 3,
                  borderLeft: '1px solid',
                  borderColor:
                    'color-mix(in srgb, currentColor 35%, transparent)',
                  height: '100%',
                  whiteSpace: 'nowrap',
                }}
              >
                {bp.toLocaleString()}
              </span>,
            )
          }
        }
        return ticks
      })}
    </div>
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
  const track = view.tracks.find(t => t.configuration.trackId === trackId)
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

/**
 * Drag the bar under a track to resize it. Two model calls:
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
 * The delta is derived from the last committed pointer position rather than
 * from where the press started, so a drag that runs into the minimum height
 * doesn't bank a debt the pointer has to pay back on the way up.
 *
 * `data-gesture-owner` is the marker `usePanZoom` tests for before it starts a
 * drag of its own. Without it, dragging this bar would pan the view sideways
 * instead — a plain `stopPropagation` would not do, since that handler runs on
 * the same pointer events this one needs.
 */
const RESIZE_HANDLE_HEIGHT = 4

const TrackResizeHandle = observer(function TrackResizeHandle({
  view,
  trackId,
}: {
  view: BrowserView
  trackId: string
}) {
  const lastYRef = useRef(0)
  const track = view.tracks.find(t => t.configuration.trackId === trackId)
  if (!track) {
    return null
  }
  const display = track.activeDisplay
  return (
    <div
      data-gesture-owner="true"
      aria-label={`Resize ${trackId}`}
      style={{
        height: RESIZE_HANDLE_HEIGHT,
        cursor: 'row-resize',
        // or the browser turns a touch-drag into a scroll and the pointer
        // stream never reaches this handler
        touchAction: 'none',
        background: 'color-mix(in srgb, currentColor 20%, transparent)',
      }}
      onPointerDown={event => {
        event.preventDefault()
        lastYRef.current = event.clientY
        display.setResizing(true)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          return
        }
        display.resizeHeight(event.clientY - lastYRef.current)
        lastYRef.current = event.clientY
      }}
      onPointerUp={event => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        display.setResizing(false)
      }}
      onPointerCancel={() => {
        display.setResizing(false)
      }}
    />
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

// Still needed even with the overlays swapped: the feature and alignments
// displays read the palette for their own content colours. See the previous
// two pages.

const AddTheChromeYouWant = observer(function AddTheChromeYouWant() {
  const [{ view, session }] = useState(makeView)
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  const palette = useSessionPalette(session, useSiteMode())

  return (
    <PaletteProvider palette={palette}>
      <DisplayChromeOverlayProvider value={plainChromeOverlays}>
        <TrackControlProvider value={plainTrackControl}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: LABEL_WIDTH, flex: 'none' }}>
              <div style={{ height: RULER_HEIGHT }} />
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
              <Ruler view={view} />
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
                  ? trackIds.map(id => (
                      <div key={id}>
                        <TrackRow view={view} trackId={id} />
                        <TrackResizeHandle view={view} trackId={id} />
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </div>
        </TrackControlProvider>
      </DisplayChromeOverlayProvider>
    </PaletteProvider>
  )
})

export default AddTheChromeYouWant
