import { Suspense, useState, useSyncExternalStore } from 'react'

import {
  PaletteProvider,
  useSessionPalette,
} from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import { SearchResultsNotFoundError } from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// A reader knows the gene, not the coordinates. Give the view an index and the
// location box you already have takes `EDEN.1` as readily as `ctgA:1,050..9,000`
// -- `navToLocString` runs the search itself, so this page adds one config key
// and no new call.
//
// What it does add is a case with nowhere to go. A query that cannot be
// narrowed to one feature has to ask which you meant, and the way JBrowse asks
// is a dialog it queues on the session -- so a host drawing its own chrome,
// which is every page here, renders nothing and the search appears to do
// nothing. That is the `Apple` button below, and the section after this one is
// the way out.
//
// There is a finished component for all of this: `SearchBox` from
// `@jbrowse/plugin-linear-genome-view` is JBrowse's own, autocomplete and result
// dialog included, and it takes the same view model. This site does not use it
// for the reason the site exists -- it is a Material UI autocomplete, and every
// page here holds a measured zero of those. Import it if that is not your
// constraint; the rest of this file is what it costs to do without.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

const volvox = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

// **`trackId` here has to be the one the index was built against**, and on this
// page that is `gff3tabix_genes` rather than the `volvox_genes` every other page
// uses. A trix row carries the id of the track its feature came from, and a hit
// navigates *and* calls `showTrack` with it, so an index built elsewhere -- by
// `jbrowse text-index` against a config you have since edited, say -- resolves
// its locations perfectly and then fails to turn a track on, reporting `Could
// not resolve identifier` through the session rather than throwing.
const featureTrack = {
  type: 'FeatureTrack',
  trackId: 'gff3tabix_genes',
  name: 'Genes',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
  },
  displayDefaults: { height: 140 },
}

// Three files from `jbrowse text-index`: the sorted index, its offsets, and the
// metadata naming the tracks that went into it. `assemblyNames` is what scopes
// the adapter -- the manager asks every adapter that claims the assembly being
// searched, so an embed with two genomes keeps two indexes and needs no routing
// of its own.
//
// Aggregate, meaning session-wide rather than attached to a track. A track may
// also carry its own `textSearchAdapter`, which is what the per-track search in
// JBrowse's own UI uses; for a location box you want the aggregate one.
const trixIndex = {
  type: 'TrixTextSearchAdapter',
  textSearchAdapterId: 'volvox-index',
  assemblyNames: ['volvox'],
  ixFilePath: {
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/trix/volvox.ix',
  },
  ixxFilePath: {
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/trix/volvox.ixx',
  },
  metaFilePath: {
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/trix/volvox_meta.json',
  },
}

// What the buttons put in the box. Five inputs, five paths, and the pair in the
// middle is the one worth clicking twice: `EDEN` and `Apple` both prefix several
// features, and only one of them asks which you meant.
const QUERIES = [
  { label: 'ctgB', hint: 'a refName — never reaches the index' },
  { label: 'EDEN.1', hint: 'one hit — navigates' },
  {
    label: 'EDEN',
    hint: 'prefixes four features and is exactly one of them — navigates',
  },
  {
    label: 'Apple',
    hint: 'prefixes three and is none of them — asks, via a dialog you do not render',
  },
  { label: 'zyzzyva', hint: 'no hits — a typed throw' },
]

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [featureTrack],
    aggregateTextSearchAdapters: [trixIndex],
    init: {
      // `init.loc` is parsed as a locstring and does NOT route through the
      // index -- only `navToLocString` does. A browser that should open on a
      // gene name has to navigate after mount rather than declare it here.
      loc: 'ctgA',
      tracks: [featureTrack.trackId],
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

// `view.ready` is false in TWO states, not one: while the assembly loads, and
// when it failed to load. Returning `null` for both -- the gate that looks
// obviously right -- turns a 404 on a sequence file into an empty box that
// never fills, with nothing anywhere saying why; the failure is a state on the
// model rather than a throw, so there is no console error either. `error` is
// read first because `loadingMessage` goes undefined once the load stops,
// however it stopped. The Loading and error states page draws the long form of
// this, and has a radio that breaks the assembly on purpose.
const ViewStatus = observer(function ViewStatus({
  view,
}: {
  view: BrowserView
}) {
  const { error, loadingMessage } = view
  return (
    <div
      role={error ? 'alert' : 'status'}
      style={{ padding: '10px 12px', fontSize: '0.85rem', opacity: 0.75 }}
    >
      {error
        ? `Could not load: ${error instanceof Error ? error.message : String(error)}`
        : (loadingMessage ?? 'Loading')}
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
  // guard stays -- `view.ready` says the view can draw, not that your track is
  // instantiated yet.
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

/**
 * The search box, which is a location box with an index behind it.
 *
 * `navToLocString(input)` does the whole resolution, in this order: if every
 * whitespace-separated token is a refName or a `ref:start..end`, it navigates
 * and the index is never consulted. Otherwise it searches, one hit navigates and
 * shows the track that hit came from, several hits ask, and none falls back to
 * parsing the input as a locstring anyway.
 *
 * **"One hit" is decided by an exact pass before the prefix one**, and that is
 * the part that surprises. A trix row is exact when *any* indexed attribute --
 * name, id, description -- equals the query, so `EDEN` prefixes four features
 * and still navigates, because one of the four is called exactly that. `Apple`
 * prefixes three and is none of them, the exact pass returns nothing, the retry
 * returns all three, and only then is there a question to ask. Without the exact
 * pass first, every gene whose name is a prefix of its own isoforms would open a
 * picker instead of going where you asked.
 *
 * So the two error shapes are worth separating. `SearchResultsNotFoundError` is
 * thrown for a plain word with no hits, and it is a distinct class precisely so
 * you can render it as a calm "no results" rather than as a failure -- the user
 * typed something reasonable and the answer is that it isn't there. Anything
 * else really is an error: a malformed range, a refName that does not exist in
 * an input that was clearly meant as coordinates. String-matching the message to
 * tell them apart is the version that breaks on the next wording change.
 *
 * `pending` is here because the search is a network round trip against a remote
 * index, unlike the pure locstring parse the Drive it from your app page's box
 * does. Two of the four buttons take long enough to notice.
 *
 * Not an `observer`: everything it renders is its own React state, and the view
 * and session are only touched from handlers. `QueuedDialogNotice` below reads
 * the session while rendering, so that one is.
 */
function NameSearchBox({
  view,
  session,
}: {
  view: BrowserView
  session: BrowserSession
}) {
  const [query, setQuery] = useState('EDEN.1')
  const [pending, setPending] = useState(false)
  const [notFound, setNotFound] = useState<string | undefined>(undefined)
  const [error, setError] = useState<unknown>(undefined)

  const run = (input: string) => {
    setNotFound(undefined)
    setError(undefined)
    setPending(true)
    view
      .navToLocString(input)
      .catch((e: unknown) => {
        if (e instanceof SearchResultsNotFoundError) {
          setNotFound(e.message)
        } else {
          setError(e)
        }
      })
      .finally(() => {
        setPending(false)
      })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <form
        style={{ display: 'flex', gap: 4 }}
        onSubmit={event => {
          event.preventDefault()
          run(query)
        }}
      >
        <input
          aria-label="Search by name or location"
          value={query}
          size={28}
          style={{ font: 'inherit', padding: '2px 4px' }}
          onChange={event => {
            setQuery(event.target.value)
          }}
        />
        <button type="submit" style={{ font: 'inherit' }}>
          {pending ? 'Searching…' : 'Go'}
        </button>
      </form>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {QUERIES.map(({ label, hint }) => (
          <button
            key={label}
            type="button"
            title={hint}
            style={{ font: 'inherit', fontSize: '0.8rem' }}
            onClick={() => {
              setQuery(label)
              run(label)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {notFound ? (
        <span role="status" style={{ fontSize: '0.8rem', opacity: 0.75 }}>
          {notFound}
        </span>
      ) : null}
      {error ? (
        <span role="alert" style={{ fontSize: '0.8rem', color: '#d97706' }}>
          {error instanceof Error ? error.message : String(error)}
        </span>
      ) : null}
      <QueuedDialogNotice session={session} />
    </div>
  )
}

/**
 * The case with nowhere to go.
 *
 * A search with more than one hit cannot navigate, so JBrowse asks -- and it
 * asks by calling `session.queueDialog`, which appends to `queueOfDialogs` and
 * expects the product to be rendering the head of that queue. `@jbrowse/react-
 * linear-genome-view2`'s own `<JBrowseLinearGenomeView>` does. A host that
 * mounts `RenderingComponent` itself, as every page on this site does, renders
 * no dialogs at all: the promise resolves, nothing throws, nothing moves, and
 * the reader concludes the search is broken.
 *
 * It is the same shape as the snackbar channel on the Loading and error states
 * page -- a side door JBrowse reports through, which is only silent because you
 * have not drawn it -- and it has the same two honest answers. Render the queue
 * (`session.DialogComponent` is a component and `session.DialogProps` its props,
 * but the component here is JBrowse's own Material one, so this site cannot),
 * or never queue one, by resolving the ambiguity yourself before you navigate.
 * The next section does the second.
 *
 * What this draws is neither: it is the *diagnostic*, so the button above has
 * something visible to do. Reading `queueOfDialogs.length` rather than
 * `DialogComponent` keeps it a count of a typed array instead of a truthiness
 * test on a component you are not going to render.
 */
const QueuedDialogNotice = observer(function QueuedDialogNotice({
  session,
}: {
  session: BrowserSession
}) {
  const queued = session.queueOfDialogs.length
  if (!queued) {
    return null
  }
  return (
    <div
      role="status"
      data-testid="queued-dialog-notice"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        fontSize: '0.8rem',
        background: 'color-mix(in srgb, CanvasText 8%, Canvas)',
        borderLeft: '3px solid #d97706',
      }}
    >
      <span>
        {queued} dialog{queued > 1 ? 's' : ''} queued on the session, and this
        host renders none — so the ambiguous search went nowhere.
      </span>
      <button
        type="button"
        style={{ font: 'inherit' }}
        onClick={() => {
          session.removeActiveDialog()
        }}
      >
        Dismiss
      </button>
    </div>
  )
})

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing and which half of it the hook cannot do for you.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  touchAction: 'none',
  cursor: 'grab',
}

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
 * JBrowse's half is one call, `useSessionPalette` below. It writes the config
 * slot that *both* halves of the rendering derive from -- the palette React
 * draws with, and the theme shipped to the worker that bakes feature labels
 * into the image -- and hands back the palette. Mounting `PaletteProvider`
 * alone would leave those baked labels in the old mode.
 */
function useSiteMode() {
  return useSyncExternalStore(
    watchSiteMode,
    readSiteMode,
    () => 'light' as const,
  )
}

const SearchByName = observer(function SearchByName() {
  const { view, session } = useCreateOnce(makeView)
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  const palette = useSessionPalette(session, useSiteMode())

  return (
    <PaletteProvider palette={palette}>
      <DisplayUIProvider>
        <div style={{ paddingBottom: 8 }}>
          <NameSearchBox view={view} session={session} />
        </div>
        <div ref={ref} {...containerProps} style={viewport}>
          {view.ready ? (
            <TrackRow view={view} trackId="gff3tabix_genes" />
          ) : (
            <ViewStatus view={view} />
          )}
        </div>
      </DisplayUIProvider>
    </PaletteProvider>
  )
})

export default SearchByName
