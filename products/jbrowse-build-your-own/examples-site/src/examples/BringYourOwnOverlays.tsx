import { Suspense, useEffect, useState } from 'react'

import { setConf } from '@jbrowse/core/configuration'
import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
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
// Two providers replace them for everything below, so the stock wiggle, feature
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
//   these providers   -- reach.  Redirect JBrowse's own displays, which import
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

const TrackStack = observer(function TrackStack({
  view,
}: {
  view: BrowserView
}) {
  const ref = useWidthSetter(view)
  const { containerProps, showZoomHint } = usePanZoom(ref, view)
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
      <ZoomHint show={showZoomHint} />
      {isViewReady(view)
        ? trackIds.map(trackId => (
            <TrackRow key={trackId} view={view} trackId={trackId} />
          ))
        : null}
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
 * back off the session.
 *
 * One write rather than two. The config theme is what the display ships to the
 * renderer, so the feature labels baked there follow it, and `session.palette`
 * is derived from the same slot, so what React draws follows it too. Setting
 * only a React-side palette would leave the labels behind.
 */
function useSitePalette(session: BrowserSession) {
  const mode = useSiteMode()
  useEffect(() => {
    setConf(session, 'theme', { palette: { mode } })
  }, [session, mode])
  return session.palette
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
 * - **Render `null` when there is no error.** The chrome mounts this
 *   unconditionally rather than switching it in, so it decides for itself
 *   whether it has anything to say.
 * - **Offer the retry.** `model.reload()` is the display's own re-fetch. An
 *   error state with no way out of it is a dead track.
 */
const MyErrorBar = observer(function MyErrorBar({
  model,
}: {
  model: DisplayErrorBarModel
}) {
  return model.error ? (
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
  const palette = useSitePalette(session)
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
          nothing gets JBrowse's own look. The corner controls follow the same
          rule through their own provider. */}
      {overlays ? (
        <DisplayChromeOverlayProvider value={overlays}>
          <TrackControlProvider value={plainTrackControl}>
            {stack}
          </TrackControlProvider>
        </DisplayChromeOverlayProvider>
      ) : (
        stack
      )}
    </div>
  )
})

export default BringYourOwnOverlays
