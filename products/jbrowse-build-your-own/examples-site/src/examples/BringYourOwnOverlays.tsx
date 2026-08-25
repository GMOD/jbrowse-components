import { Suspense, useState, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import {
  DisplayUIProvider,
  TrackOverlaySlot,
  plainChromeOverlays,
} from '@jbrowse/display-ui'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type {
  DisplayChromeOverlays,
  DisplayErrorBarModel,
  DisplayLoadingOverlayModel,
} from '@jbrowse/display-ui'

// A display draws two kinds of UI that are not data. Its *status states* --
// loading scrim, error bar, too-large banner, render error -- go through five
// swappable components, and the *controls in its bottom-right corner* (track
// sizing, and on this page's Genes track the isoform notice) go through one
// more. By default both are JBrowse's own, which are Material UI.
//
// One provider replaces both for everything below, so the stock wiggle, feature
// and alignments displays here render no Material UI at all. The radio switches
// between three sets: `myOverlays`, written at the bottom of this file;
// `plainChromeOverlays`, the dependency-free one JBrowse ships; and no provider
// at all, which is the Material default.
//
// The third track points at a URL that does not exist. That is deliberate: the
// error state is the easiest one to hold still and look at, and it is the one
// the three sets differ most visibly on.
//
// Two seams, for two different problems:
//
//   this provider     -- reach.  Redirects JBrowse's own displays, which import
//                        DisplayChrome and TrackControl directly and so cannot
//                        be redirected at the import level. MUI still ends up
//                        in the bundle; nothing on screen renders it.
//   DisplayChromeBase -- weight. Takes `overlays` as a prop and imports no
//                        toolkit at all, so MUI never enters the graph.
//                        Available when you write your own display component.
//
// `@jbrowse/display-ui` itself depends on no UI toolkit, so taking the first
// route does not download the toolkit you are declining to render. Until 2026-08
// it did: the contract lived beside the Material implementations of it, and this
// page carried twice the Material UI of the page that keeps Material on screen.
//
// Self-contained: the parts from the earlier pages are repeated here rather
// than imported, so this file runs on its own.

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

const brokenTrack = {
  type: 'QuantitativeTrack',
  trackId: 'hg38_broken',
  name: 'A track that fails to load',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/does-not-exist.bw',
  },
  displayDefaults: { height: 80 },
}

const trackIds = ['hg38_phylop', 'hg38_genes', 'hg38_broken']

function makeView() {
  const state = createViewState({
    assembly: hg38,
    tracks: [conservationTrack, featureTrack, brokenTrack],
    init: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: trackIds,
    },
  })
  const { view } = state.session
  // see the Pan and zoom example: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
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

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing, and for the one the hook writes itself.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  cursor: 'grab',
}

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

// The palette is NOT what the radio swaps. JBrowse's stock displays read it for
// their own content colours (the feature display wants a highlight colour), so a
// feature track needs it whatever the overlays are. See the previous page.

// One brand colour, standing in for whatever your design system would supply.
const ACCENT = '#3a7ca5'

const card: React.CSSProperties = {
  pointerEvents: 'auto',
  margin: 6,
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: '0.78rem',
  color: 'CanvasText',
  background: 'color-mix(in srgb, Canvas 92%, transparent)',
  boxShadow: `inset 0 0 0 1.5px ${ACCENT}`,
}

const linkButton: React.CSSProperties = {
  font: 'inherit',
  marginLeft: 8,
  padding: 0,
  border: 0,
  background: 'none',
  color: ACCENT,
  fontWeight: 600,
  cursor: 'pointer',
}

// Every overlay is drawn over a live canvas, so the box that positions it must
// not eat pointer events -- only the card inside it takes them back.
const overlayBox: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 1,
}

/**
 * A fetch that failed, drawn over whatever is already painted.
 *
 * Two things the contract asks of it, and both are easy to miss:
 *
 * - **Gate on `visible`, never on `model.error`.** The chrome mounts this
 *   unconditionally rather than switching it in -- that is what lets a
 *   replacement keep state across one fetch and the next -- and passes
 *   `visible`, which is `displayPhase === 'error'`, the display's own
 *   mutually-exclusive state. Deciding for yourself from the error field
 *   re-encodes the precedence that phase exists to keep in one place, and
 *   agrees with it only by construction. Both sets JBrowse ships did that once;
 *   both were changed to take the prop.
 * - **Offer the retry.** `model.reload()` is the display's own re-fetch. An
 *   error state with no way out of it is a dead track.
 */
const MyErrorBar = observer(function MyErrorBar({
  model,
  visible,
}: {
  model: DisplayErrorBarModel
  visible: boolean
}) {
  return visible && model.error ? (
    <div style={{ ...overlayBox, alignItems: 'flex-start' }} role="alert">
      <div style={card}>
        <span style={{ wordBreak: 'break-word' }}>
          {model.error instanceof Error ? model.error.message : 'Failed'}
        </span>
        <button
          type="button"
          style={linkButton}
          data-testid="reload_button"
          onClick={() => {
            model.reload()
          }}
        >
          Try again
        </button>
      </div>
    </div>
  ) : null
})

/**
 * The loading scrim. Also mounted unconditionally -- `visible` is the chrome
 * telling it the display is in the loading phase, and gating on that here is
 * what lets a replacement keep state (an anti-flash delay, an animation) across
 * one fetch and the next.
 *
 * `cancelFetchByUser` stops the fetch; `fetchCanceled` is the state that leaves
 * behind, and it is deliberately durable -- nothing restarts on its own. So the
 * canceled branch **must** carry `reload`, or a user who cancels is left with a
 * stopped, empty track and nothing to click. Both are optional on the model
 * (not every display can cancel), so both are checked.
 */
const MyLoading = observer(function MyLoading({
  model,
  visible,
}: {
  model: DisplayLoadingOverlayModel
  visible: boolean
}) {
  if (!visible) {
    return null
  }
  const { statusMessage, statusProgress, fetchCanceled } = model
  return (
    <div style={{ ...overlayBox, alignItems: 'flex-start' }}>
      <div style={card} data-testid="loading-overlay">
        {fetchCanceled ? (
          <>
            <span>Stopped</span>
            {model.reload ? (
              <button
                type="button"
                style={linkButton}
                data-testid="loading-overlay-retry"
                onClick={() => {
                  model.reload?.()
                }}
              >
                Resume
              </button>
            ) : null}
          </>
        ) : (
          <>
            <span>
              {statusMessage || 'Loading'}
              {statusProgress === undefined
                ? '…'
                : ` ${Math.round(statusProgress * 100)}%`}
            </span>
            {model.cancelFetchByUser ? (
              <button
                type="button"
                style={linkButton}
                data-testid="loading-overlay-cancel"
                onClick={() => {
                  model.cancelFetchByUser?.()
                }}
              >
                Stop
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
})

// A set is five components; `overlays` takes a partial one and merges it over
// the plain set, so this names only the two a user actually meets. The rest --
// the too-large banner and the GPU-failure banner, which want a "Force load"
// and a "Use Canvas2D" button respectively -- are worth inheriting until you
// have a reason not to, and a state added to JBrowse later arrives with a
// working default rather than a hole.
//
// The `data-testid`s above are kept deliberately: JBrowse's own test suites key
// on them, so a set that keeps them can be driven by those suites too.
const myOverlays: Partial<DisplayChromeOverlays> = {
  ErrorBar: MyErrorBar,
  Loading: MyLoading,
}

const OVERLAY_SETS = {
  mine: { label: 'a set written in this file', overlays: myOverlays },
  plain: {
    label: 'the plain set JBrowse ships',
    overlays: plainChromeOverlays,
  },
  jbrowse: { label: "JBrowse's own — Material UI", overlays: undefined },
}

type SetName = keyof typeof OVERLAY_SETS

const BringYourOwnOverlays = observer(function BringYourOwnOverlays() {
  const [setName, setSetName] = useState<SetName>('mine')
  const { view, session } = useCreateOnce(makeView)
  const mode = useSiteMode()
  const { overlays } = OVERLAY_SETS[setName]

  const stack = (
    <SessionPaletteProvider session={session} mode={mode}>
      <TrackStack view={view} />
    </SessionPaletteProvider>
  )

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          fontSize: '0.85rem',
          paddingBottom: 8,
        }}
      >
        Draw the status states with
        {Object.entries(OVERLAY_SETS).map(([name, { label }]) => (
          <label
            key={name}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <input
              type="radio"
              name="overlay-set"
              checked={setName === name}
              onChange={() => {
                setSetName(name as SetName)
              }}
            />
            {label}
          </label>
        ))}
      </div>
      {/* No provider at all is the third state: the components a display
          imports directly are the Material ones, so an embedder who installs
          nothing gets JBrowse's own look. One provider covers both seams --
          the status states and the corner controls -- because nobody wants
          plain scrims with Material corner buttons.

          Note the cost of that third state being an *absence*: the element at
          this position changes, so React remounts the tracks below it and all
          three canvases are replaced, GPU contexts included. Only this radio
          does it -- switching between the two sets above keeps them. There is
          no argument meaning "the Material default", since mounting the
          provider is itself the request for something else, so a demo that
          offers the comparison at runtime pays a remount for it. Yours won't:
          an app picks a set once. */}
      {overlays ? (
        <DisplayUIProvider overlays={overlays}>{stack}</DisplayUIProvider>
      ) : (
        stack
      )}
    </div>
  )
})

export default BringYourOwnOverlays
