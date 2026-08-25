import { Suspense, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { isFeature } from '@jbrowse/core/util/simpleFeature'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
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
  displayDefaults: { height: 180 },
}

const PANEL_WIDTH = 260

function makeView() {
  const state = createViewState({
    assembly: hg38,
    tracks: [featureTrack],
    init: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['hg38_genes'],
    },
  })
  const { view } = state.session
  // see the Pan and zoom example: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
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

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing, and for the one the hook writes itself.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  cursor: 'grab',
}

const YourOwnFeatureDetails = observer(function YourOwnFeatureDetails() {
  const { view, session } = useCreateOnce(makeView)
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  const mode = useSiteMode()

  return (
    <SessionPaletteProvider session={session} mode={mode}>
      <DisplayUIProvider>
        <div style={{ display: 'flex' }}>
          <div
            ref={ref}
            {...containerProps}
            // `flex: 1, minWidth: 0` because the panel beside it is fixed
            // width and this half takes the rest; without the minWidth a flex
            // item refuses to shrink below its content
            style={{ ...viewport, flex: 1, minWidth: 0 }}
          >
            {view.status.type === 'ready' ? (
              <TrackRow view={view} trackId="hg38_genes" />
            ) : (
              <ViewStatus view={view} />
            )}
          </div>
          <div
            style={{
              width: PANEL_WIDTH,
              flex: 'none',
              borderLeft: '1px solid',
              borderColor: 'color-mix(in srgb, currentColor 25%, transparent)',
              overflow: 'auto',
            }}
          >
            <FeatureDetails session={session} />
          </div>
        </div>
      </DisplayUIProvider>
    </SessionPaletteProvider>
  )
})

export default YourOwnFeatureDetails
