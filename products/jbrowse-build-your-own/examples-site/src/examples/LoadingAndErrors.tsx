import { Suspense, useState, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import {
  createViewState,
  destroyViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// Every page before this one gates its tracks on `view.status`, and draws one
// of its four values. This page draws the other three.
//
// - **loading** -- carries `message` and `progress`. The assembly reports which
//   of its files it is downloading, so this is "Downloading chromosome
//   aliases", not a bare spinner.
// - **error** -- carries `error`. A FASTA behind a 404, a CORS-blocked index, a
//   `loc` naming a contig the assembly does not have. Pick the radio below and
//   watch it happen.
// - **noRegions** -- nothing has told the view where to look yet. The older
//   `view.ready` getter reports this one as *ready*, so a host gating on that
//   mounts its tracks over a view with no regions and draws an empty box.
// - **ready** -- the tracks.
//
// And one more channel that is not on the view at all:
// **`session.snackbarMessages`**. `showTrack` with an id that isn't in the
// config, a session track whose config won't validate, an `init.loc` that
// fails to resolve -- JBrowse reports all of those by pushing a message onto
// the session and carrying on. JBrowse's own apps draw a snackbar for it; a
// host drawing its own chrome renders nothing, so those messages are dropped
// on the floor unless you read the array. The button below fires one.
//
// And because each radio builds a whole new engine, this is the only page here
// that *throws one away* -- so it is where `destroyViewState` lives. An engine
// is not owned by React, and unmounting the component that drew it leaves its
// autoruns and its worker threads running. See the bottom of the file.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

const volvox = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

// The same assembly with one character changed. A 404 on the sequence file is
// the most ordinary way an embed fails -- a moved bucket, a typo, a signed URL
// that expired -- and it is indistinguishable from "still loading" unless
// something reads `view.error`.
const brokenVolvox = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/does-not-exist.2bit',
}

// Big enough that its load is something you can watch rather than infer. The
// `.fa.gz` needs an index and a gzi beside it and `refNameAliases` is a fourth
// file, so `loadingMessage` has several things to name in turn.
const hg38 = {
  name: 'hg38',
  uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
  },
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

const conservationTrack = {
  type: 'QuantitativeTrack',
  trackId: 'hg38_phylop',
  name: 'phyloP 100-way conservation',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
  },
  // A bigWig carries precomputed summaries, so a track that would be hopeless
  // at this width as raw values -- 3.1Gb across ~1000px -- is one cheap read
  // per region instead.
  displayDefaults: {
    defaultRendering: 'xyplot',
    height: 120,
    color: '#3a7ca5',
  },
}

// Three engines, one per radio button. Each is a whole `createViewState`, and
// the demo builds a fresh one to switch -- an assembly is not something you
// swap on a live view. So this is also the one page here that *discards*
// engines, which is what `destroyViewState` below is about.
const SCENARIOS = {
  ready: {
    label: 'volvox — loads, then draws',
    assembly: volvox,
    track: wiggleTrack,
    loc: 'ctgA:1..20,000',
  },
  slow: {
    label: 'hg38 — two files to fetch first',
    assembly: hg38,
    track: conservationTrack,
    loc: 'chr1:1..2,000,000',
  },
  broken: {
    label: 'a sequence file behind a 404',
    assembly: brokenVolvox,
    track: wiggleTrack,
    loc: 'ctgA:1..20,000',
  },
}

type ScenarioName = keyof typeof SCENARIOS

// `state` comes back alongside the view here, unlike on every other page. It is
// the root of the engine, and it is what `destroyViewState` takes -- a view is a
// node inside that tree, not a handle on it.
function makeView(name: ScenarioName) {
  const { assembly, track, loc } = SCENARIOS[name]
  const state = createViewState({
    assembly,
    tracks: [track],
    init: {
      loc,
      tracks: [track.trackId],
    },
  })
  const { view } = state.session
  // see the Pan and zoom example: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
  view.setScrollZoom(true)
  return { state, view, session: state.session, trackId: track.trackId }
}

type BrowserView = ReturnType<typeof makeView>['view']
type BrowserSession = ReturnType<typeof makeView>['session']

// The whole engine, passed around as one thing on this page because it is the
// page that discards one. Every other page only ever needs the two above.
type Engine = ReturnType<typeof makeView>

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

const statusBox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  fontSize: '0.85rem',
  minHeight: 100,
  boxSizing: 'border-box',
}

/**
 * What to draw for the three values of `view.status.type` that are not `ready`.
 * Every other page on this site carries a one-line `ViewStatus` doing the same
 * job; this is the long form, because this is the page about it.
 *
 * A `switch` rather than a chain of reads off the view, and the payload comes
 * attached to the branch. That is what makes the ordering trap unwritable: the
 * old shape read `error` and `loadingMessage` off the model separately, and
 * `loadingMessage` goes `undefined` once a load stops -- however it stopped --
 * so checking the error second showed a failure already painted over by
 * "Loading" having gone away.
 *
 * `progress` is a 0..1 fraction and is `undefined` on purpose: a download only
 * reports one when the response carried a Content-Length. Draw a determinate
 * bar when it is there and an indeterminate one when it is not, rather than
 * treating `undefined` as zero.
 *
 * There is no retry here, and that is not an omission: a view-level failure is
 * a bad config or a bad URL rather than a flaky fetch, so what a user needs is
 * to be told, and what you need is the message. The per-track error bar --
 * see the Removing Material UI page -- *does* carry a retry, because a track
 * fetch is the one that fails transiently.
 */
const ViewStatusPanel = observer(function ViewStatusPanel({
  view,
}: {
  view: BrowserView
}) {
  const { status } = view
  switch (status.type) {
    case 'ready':
      return null
    case 'error':
      return (
        <div style={{ ...statusBox, alignItems: 'flex-start' }} role="alert">
          <div>
            <strong>This browser could not load.</strong>
            <div
              style={{ opacity: 0.8, paddingTop: 4, wordBreak: 'break-word' }}
            >
              {status.error instanceof Error
                ? status.error.message
                : String(status.error)}
            </div>
          </div>
        </div>
      )
    case 'loading':
      return (
        <div style={statusBox}>
          <progress
            aria-label="Loading"
            // an indeterminate <progress> is one with no `value` at all
            value={status.progress}
            max={1}
            style={{ width: 120 }}
          />
          <span style={{ opacity: 0.75 }}>{status.message}</span>
        </div>
      )
    case 'noRegions':
      return (
        <div style={statusBox}>
          <span style={{ opacity: 0.75 }}>
            Nothing has navigated this view yet.
          </span>
        </div>
      )
  }
})

/**
 * The channel that is not on the view.
 *
 * `session.snackbarMessages` is an observable array of `{message, level,
 * actions}`, and JBrowse pushes onto it from every path that has to keep going
 * after something went wrong: `showTrack` with an unresolvable id,
 * `addSessionTrackConf` with a config that fails validation, the init
 * navigation failing to resolve its locstring. Those calls do not throw and do
 * not return an error -- `showTrack` just hands back `undefined` -- so this
 * array is the only place the reason exists.
 *
 * Info and success messages expire on their own after five seconds; warnings
 * and errors stay until something takes them off, which is why a dismiss
 * control is required rather than polite. `popSnackbarMessage()` removes the
 * newest; `removeSnackbarMessage(text)` removes a particular one by its text.
 *
 * `actions` is what JBrowse would have drawn as buttons on the toast -- an
 * error's is "report", which opens its own stack-trace dialog. Rendering them
 * is optional and this page skips it; reading `message` and `level` is not.
 */
const Notifications = observer(function Notifications({
  session,
}: {
  session: BrowserSession
}) {
  // the newest one, and `popSnackbarMessage` takes it back off -- which is
  // exactly what JBrowse's own `Snackbar` does. Rendering the array as a list
  // is the version that looks better and breaks: `pushSnackbarMessage` dedupes
  // by text only for messages with no actions, and `notifyError` always
  // attaches one (its "report" button), so the same failure twice really is two
  // entries with identical text and there is no stable key to give them.
  const latest = session.snackbarMessages.at(-1)
  if (!latest) {
    return null
  }
  const { message, level } = latest
  return (
    <div
      role={level === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 8,
        padding: '4px 8px',
        fontSize: '0.8rem',
        // CSS system colours, so this reads on whatever the host page is
        background: 'color-mix(in srgb, CanvasText 8%, Canvas)',
        borderLeft: `3px solid ${level === 'error' ? '#d97706' : 'CanvasText'}`,
      }}
    >
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        style={{ font: 'inherit', border: 0, background: 'none' }}
        onClick={() => {
          session.popSnackbarMessage()
        }}
      >
        ✕
      </button>
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

/**
 * One scenario's browser. Everything above the gate is the earlier pages; the
 * gate itself is the page.
 *
 * The engine arrives as a prop rather than being built here, which is the other
 * half of the teardown below: whoever builds one has to be the one that
 * discards it, and that is not this component.
 */
const Browser = observer(function Browser({ engine }: { engine: Engine }) {
  const { view, session, trackId } = engine
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  const mode = useSiteMode()

  return (
    <SessionPaletteProvider session={session} mode={mode}>
      <DisplayUIProvider>
        <div>
          <button
            type="button"
            style={{ font: 'inherit', marginBottom: 8 }}
            onClick={() => {
              // returns `undefined` and reports the reason through the session.
              // Nothing throws, so a host that draws no notifications sees a
              // checkbox tick and a track that never appears.
              view.showTrack('a_track_that_is_not_in_the_config')
            }}
          >
            Show a track that isn't in the config
          </button>
          <div ref={ref} {...containerProps} style={viewport}>
            {view.status.type === 'ready' ? (
              <TrackRow view={view} trackId={trackId} />
            ) : (
              <ViewStatusPanel view={view} />
            )}
          </div>
          <Notifications session={session} />
        </div>
      </DisplayUIProvider>
    </SessionPaletteProvider>
  )
})

/**
 * The engine is not owned by React, and this is the page where that has teeth.
 *
 * Picking a radio builds a whole new `createViewState` -- which is the only way
 * to replay a load, and an assembly is not swappable on a live view -- so the
 * one that was on screen is now garbage. Unmounting the component that rendered
 * it does **not** stop it: an engine is an MST tree with `addDisposer`'d
 * autoruns and an RPC manager holding worker threads, none of which React knows
 * about. Three clicks without this call leaves three live engines fetching.
 *
 * `destroyViewState(state)` terminates the workers and destroys the tree, and it
 * is idempotent. Note it is called in the **handler that discards the engine**,
 * not in an effect cleanup. Written the obvious way -- `useEffect(() => () =>
 * destroyViewState(state), [])` -- the cleanup is a trap: StrictMode mounts,
 * cleans up and re-mounts in development, so an unmount-time teardown destroys
 * the engine the demo is still using. (`useFinalUnmount` in
 * `@jbrowse/core/util/hooks` is that spelling done right, for a host whose
 * engine really does die with its component.) Here a discard is something your
 * app does rather than something a render does, so the handler is the place.
 *
 * `name` and `engine` live in one state object so they cannot disagree about
 * which scenario is on screen. The **first** engine is built by
 * `useCreateOnce`, not in that state initializer, because the build side has
 * the mirror-image StrictMode trap: an initializer runs twice and the second
 * result is thrown away, so an engine built in one is an orphan per mount with
 * nothing left holding it to destroy. Every other page here builds its engine
 * with the same call and never discards one.
 *
 * Most hosts never call `destroyViewState`: a page that builds one engine and
 * keeps it until the tab closes has nothing to clean up. It is for the ones
 * that churn -- an SPA route change, a re-run notebook cell, a dashboard
 * swapping datasets.
 */
const LoadingAndErrors = observer(function LoadingAndErrors() {
  const firstEngine = useCreateOnce(() => makeView('ready'))
  const [current, setCurrent] = useState(() => ({
    name: 'ready' as ScenarioName,
    engine: firstEngine,
  }))

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
        Load
        {Object.entries(SCENARIOS).map(([key, { label }]) => (
          <label
            key={key}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <input
              type="radio"
              name="scenario"
              checked={current.name === key}
              onChange={() => {
                destroyViewState(current.engine.state)
                setCurrent({
                  name: key as ScenarioName,
                  engine: makeView(key as ScenarioName),
                })
              }}
            />
            {label}
          </label>
        ))}
      </div>
      {/* keyed on the scenario so the chrome around the new engine starts
          clean -- the width setter, the gesture layer and the palette all
          rebind rather than being handed a different view mid-life */}
      <Browser key={current.name} engine={current.engine} />
    </div>
  )
})

export default LoadingAndErrors
