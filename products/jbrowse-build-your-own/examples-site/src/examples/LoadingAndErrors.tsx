import { Suspense, useEffect, useState } from 'react'

import {
  PaletteProvider,
  useSessionPalette,
} from '@jbrowse/core/ui/PaletteContext'
import { useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider } from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// Every page before this one gates its tracks on `view.ready`. That getter has
// three outcomes and the gate only draws one, so this page draws the other two.
//
// - **loading** -- `view.loadingMessage` and `view.loadingProgress`. The
//   assembly reports which of its files it is downloading, so this is
//   "Downloading chromosome aliases", not a bare spinner.
// - **error** -- `view.error`. A FASTA behind a 404, a CORS-blocked index, a
//   `loc` naming a contig the assembly does not have. `ready` is false here
//   too, so `view.ready ? tracks : null` renders an empty box forever with
//   nothing anywhere saying why. Pick the radio below and watch it happen.
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
// the demo remounts to switch -- an assembly is not something you swap on a
// live view.
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

function makeView(name: ScenarioName) {
  const { assembly, track, loc } = SCENARIOS[name]
  const state = createViewState({
    assembly,
    tracks: [track],
  })
  const { view } = state.session
  view.setInit({
    assembly: assembly.name,
    loc,
    tracks: [track.trackId],
  })
  // see the Pan and zoom example: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']
type BrowserSession = ReturnType<typeof makeView>['session']

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
 * What to draw when `view.ready` is false. Every other page on this site
 * carries a one-line `ViewStatus` doing the same job; this is the long form,
 * because this is the page about it.
 *
 * **`ready` is `!showLoading && !error`, so its `false` covers two states, not
 * one.** That is the whole reason this component exists: `view.ready ? tracks :
 * null` is the shape everything reaches for, and it turns a failed assembly
 * load into an empty box that never fills, on a page with nothing else to say
 * so. There is no console error either -- the failure is a state on the model,
 * not a throw.
 *
 * Read `error` first, because it is the terminal one. `loadingMessage` is
 * `undefined` once the load has stopped, whether it stopped by finishing or by
 * failing, so an error checked second is an error already painted over by
 * "Loading" having gone away.
 *
 * `loadingProgress` is a 0..1 fraction, and it is optional on purpose: a
 * download only reports one when the response carried a Content-Length. Draw a
 * determinate bar when it is there and an indeterminate one when it is not,
 * rather than treating `undefined` as zero.
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
  const { error, loadingMessage, loadingProgress } = view
  if (error) {
    return (
      <div style={{ ...statusBox, alignItems: 'flex-start' }} role="alert">
        <div>
          <strong>This browser could not load.</strong>
          <div style={{ opacity: 0.8, paddingTop: 4, wordBreak: 'break-word' }}>
            {error instanceof Error ? error.message : String(error)}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div style={statusBox}>
      <progress
        aria-label="Loading"
        // an indeterminate <progress> is one with no `value` at all
        value={loadingProgress}
        max={1}
        style={{ width: 120 }}
      />
      <span style={{ opacity: 0.75 }}>{loadingMessage ?? 'Loading'}</span>
    </div>
  )
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

/**
 * One scenario's browser. Everything above the gate is the earlier pages; the
 * gate itself is the page.
 */
const Browser = observer(function Browser({ name }: { name: ScenarioName }) {
  const [{ view, session }] = useState(() => makeView(name))
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  const palette = useSessionPalette(session, useSiteMode())
  const { trackId } = SCENARIOS[name].track

  return (
    <PaletteProvider palette={palette}>
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
            {view.ready ? (
              <TrackRow view={view} trackId={trackId} />
            ) : (
              <ViewStatusPanel view={view} />
            )}
          </div>
          <Notifications session={session} />
        </div>
      </DisplayUIProvider>
    </PaletteProvider>
  )
})

const LoadingAndErrors = observer(function LoadingAndErrors() {
  const [name, setName] = useState<ScenarioName>('ready')

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
              checked={name === key}
              onChange={() => {
                setName(key as ScenarioName)
              }}
            />
            {label}
          </label>
        ))}
      </div>
      {/* keyed on the scenario, so picking one builds a fresh engine rather
          than mutating a live view's assembly. That also replays the load,
          which is the only way to see the loading state twice. */}
      <Browser key={name} name={name} />
    </div>
  )
})

export default LoadingAndErrors
