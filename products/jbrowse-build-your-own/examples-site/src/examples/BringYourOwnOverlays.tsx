import { Suspense, useEffect, useState } from 'react'

import {
  PaletteProvider,
  useSessionPalette,
} from '@jbrowse/core/ui/PaletteContext'
import { useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import {
  DisplayUIProvider,
  plainChromeOverlays,
} from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type {
  DisplayChromeOverlays,
  DisplayErrorBarModel,
  DisplayLoadingOverlayModel,
} from '@jbrowse/plugin-linear-genome-view'

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
// Self-contained: the parts from the earlier pages are repeated here rather
// than imported, so this file runs on its own.

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

const brokenTrack = {
  type: 'QuantitativeTrack',
  trackId: 'volvox_broken',
  name: 'A track that fails to load',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/does-not-exist.bw',
  },
  displayDefaults: { height: 80 },
}

const trackIds = ['volvox_microarray', 'volvox_genes', 'volvox_broken']

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack, featureTrack, brokenTrack],
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    loc: 'ctgA:1..20,000',
    tracks: trackIds,
  })
  // see the Pan and zoom example: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
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

// A set is five components, and this replaces the two a user actually meets.
// Spreading `plainChromeOverlays` supplies the rest -- the too-large banner and
// the GPU-failure banner, which want a "Force load" and a "Use Canvas2D" button
// respectively and are worth inheriting until you have a reason not to.
//
// The `data-testid`s above are kept deliberately: JBrowse's own test suites key
// on them, so a set that keeps them can be driven by those suites too.
const myOverlays: DisplayChromeOverlays = {
  ...plainChromeOverlays,
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
  const [{ view, session }] = useState(makeView)
  const palette = useSessionPalette(session, useSiteMode())
  const { overlays } = OVERLAY_SETS[setName]

  const stack = (
    <PaletteProvider palette={palette}>
      <TrackStack view={view} />
    </PaletteProvider>
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
