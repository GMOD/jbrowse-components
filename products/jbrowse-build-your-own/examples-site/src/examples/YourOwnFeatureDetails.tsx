import { Suspense, useEffect, useState } from 'react'

import { setConf } from '@jbrowse/core/configuration'
import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useWidthSetter } from '@jbrowse/core/util/hooks'
import { isFeature } from '@jbrowse/core/util/simpleFeature'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import {
  DisplayChromeOverlayProvider,
  TrackControlProvider,
  plainChromeOverlays,
  plainTrackControl,
} from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// Every page before this one puts pixels on screen. This one gets data back
// out: click a gene and the panel on the right fills in.
//
// Note what is NOT below: an onClick. The display already handles the click --
// hit-testing the canvas, re-fetching the full feature by id, descending into
// the clicked subfeature -- and finishes by writing the result to
// `session.selection`. So the whole integration is one observer that reads that
// field. You never register a handler, and you never have to know how a click
// lands on a feature drawn into a canvas.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

const volvox = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
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
  displayDefaults: { height: 180 },
}

const PANEL_WIDTH = 260

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [featureTrack],
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    loc: 'ctgA:1..20,000',
    tracks: ['volvox_genes'],
  })
  // see the Pan and zoom page: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']
type BrowserSession = ReturnType<typeof makeView>['session']

// see the One track page for why this is not `view.initialized`
function isViewReady(view: BrowserView) {
  return !view.showLoading && !view.error
}

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

// the prompt for a wheel the view ignored; `showZoomHint` is raised for
// exactly that and clears itself. See the Pan and zoom page.
function ZoomHint({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden={!show}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        background: 'color-mix(in srgb, Canvas 62%, transparent)',
        color: 'CanvasText',
        fontSize: '0.95rem',
        opacity: show ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}
    >
      Use ctrl + scroll to zoom
    </div>
  )
}

// Fields the panel promotes to a header line, so the rest of the table is the
// track's own attributes rather than coordinates repeated in two places.
const POSITION_FIELDS = new Set([
  'refName',
  'start',
  'end',
  'strand',
  'type',
  'name',
  'uniqueId',
])

/**
 * `feature.toJSON()` is a plain object -- the parsed GFF3 attributes for this
 * track, whatever they happen to be. Nested values (`subfeatures` is the one
 * every gene has) are skipped rather than stringified; showing a transcript
 * tree is its own UI, and this page is about where the data arrives, not about
 * rendering all of it.
 */
function attributeRows(data: Record<string, unknown>) {
  return Object.entries(data)
    .filter(
      ([key, value]) =>
        !POSITION_FIELDS.has(key) &&
        value !== undefined &&
        value !== null &&
        typeof value !== 'object',
    )
    .map(([key, value]) => [key, String(value)] as const)
}

/**
 * The whole integration with JBrowse: read `session.selection`.
 *
 * It is a volatile MobX field holding whatever was last selected anywhere in
 * the session, so it is typed `unknown` on purpose -- a circular view selects
 * chords, an arc display selects paired features. `isFeature` is the narrowing
 * JBrowse itself uses, and it is what makes reading this field safe rather than
 * a cast.
 *
 * JBrowse's own click path also queues its `BaseFeatureWidget` into
 * `session.widgets`. Nothing here renders the drawer that would show it, so it
 * costs nothing: a widget's React component is lazy, so an unrendered widget
 * never loads, and Material UI never enters the graph on account of it.
 */
const FeatureDetails = observer(function FeatureDetails({
  session,
}: {
  session: BrowserSession
}) {
  const { selection } = session
  if (!isFeature(selection)) {
    return (
      <div style={{ fontSize: '0.85rem', opacity: 0.7, padding: 12 }}>
        Click a gene.
      </div>
    )
  }
  const data = selection.toJSON()
  const strand = data.strand === -1 ? '−' : data.strand === 1 ? '+' : ''
  return (
    <div style={{ fontSize: '0.8rem', padding: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <strong style={{ fontSize: '0.95rem' }}>
          {data.name ?? data.type ?? 'Feature'}
        </strong>
        <button
          type="button"
          style={{ font: 'inherit', cursor: 'pointer' }}
          onClick={() => {
            session.clearSelection()
          }}
        >
          Clear
        </button>
      </div>
      <div style={{ opacity: 0.75, paddingTop: 2 }}>
        {data.refName}:{data.start.toLocaleString()}-{data.end.toLocaleString()}{' '}
        {strand}
      </div>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '2px 10px',
          margin: '10px 0 0',
        }}
      >
        {attributeRows(data).map(([key, value]) => (
          <div key={key} style={{ display: 'contents' }}>
            <dt style={{ opacity: 0.7 }}>{key}</dt>
            <dd style={{ margin: 0, wordBreak: 'break-word' }}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
})

/**
 * The page around this demo has a light/dark toggle. JBrowse needs to be told,
 * because a display paints no background of its own: its labels are drawn
 * straight onto whatever is behind them, so light-theme text on a dark page is
 * near-black on near-black.
 *
 * The toggle writes an attribute on <html>, and the OS preference arrives as a
 * media query. Either can move without the other, so watch both.
 */
function readSiteMode(): 'light' | 'dark' {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') {
    return chosen
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

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

/**
 * Write the mode onto the session's config theme, and read the resolved colors
 * back off the session. See the Bring your own overlays page for why this is
 * one write rather than two.
 */
function useSitePalette(session: BrowserSession) {
  const mode = useSiteMode()
  useEffect(() => {
    setConf(session, 'theme', { palette: { mode } })
  }, [session, mode])
  return session.palette
}

const YourOwnFeatureDetails = observer(function YourOwnFeatureDetails() {
  const [{ view, session }] = useState(makeView)
  const ref = useWidthSetter(view)
  const { containerProps, showZoomHint } = usePanZoom(ref, view)
  const palette = useSitePalette(session)

  return (
    <PaletteProvider palette={palette}>
      <DisplayChromeOverlayProvider value={plainChromeOverlays}>
        <TrackControlProvider value={plainTrackControl}>
          <div style={{ display: 'flex' }}>
            <div
              ref={ref}
              {...containerProps}
              style={{
                flex: 1,
                minWidth: 0,
                position: 'relative',
                overflow: 'hidden',
                touchAction: 'none',
                cursor: 'grab',
              }}
            >
              <ZoomHint show={showZoomHint} />
              {isViewReady(view) ? (
                <TrackRow view={view} trackId="volvox_genes" />
              ) : null}
            </div>
            <div
              style={{
                width: PANEL_WIDTH,
                flex: 'none',
                borderLeft: '1px solid',
                borderColor:
                  'color-mix(in srgb, currentColor 25%, transparent)',
                overflow: 'auto',
              }}
            >
              <FeatureDetails session={session} />
            </div>
          </div>
        </TrackControlProvider>
      </DisplayChromeOverlayProvider>
    </PaletteProvider>
  )
})

export default YourOwnFeatureDetails
