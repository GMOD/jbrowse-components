import { Suspense, useEffect, useState, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import {
  useCreateOnce,
  useDebounce,
  useWidthSetter,
} from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import { fetchResults } from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

// The section above ends on a search that silently does nothing, because a name
// with several matches asks a question through a dialog this host does not
// draw. The fix is not to draw the dialog. It is to do the asking yourself, and
// call the view only once there is one answer.
//
// `fetchResults` is that half of the search, published on its own: query in,
// `BaseResult[]` out, no navigation and no dialog. Everything below it -- the
// list, the debounce, the keyboard handling -- is ordinary UI, and navigating a
// chosen hit is two calls you have already seen.
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

// see the section above: the id has to match the one the trix index was built
// against, because a hit turns its own track on
const featureTrack = {
  type: 'FeatureTrack',
  trackId: 'genes',
  name: 'NCBI RefSeq genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
  },
  displayDefaults: { height: 140 },
}

const trixIndex = {
  type: 'TrixTextSearchAdapter',
  textSearchAdapterId: 'hg38-index',
  assemblyNames: ['hg38'],
  ixFilePath: {
    uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix',
  },
  ixxFilePath: {
    uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ixx',
  },
}

function makeView() {
  const state = createViewState({
    assembly: hg38,
    tracks: [featureTrack],
    aggregateTextSearchAdapters: [trixIndex],
    init: {
      loc: 'chr17:43,044,295..43,125,364',
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

/**
 * Run the query, and keep the answer that belongs to it.
 *
 * `fetchResults` takes the query plus the two things that can answer it, and
 * they are separate on purpose: `textSearchManager` asks every aggregate adapter
 * scoped to the assembly, while `assembly` is scanned for refName matches --
 * aliases resolved, so typing `chr17` returns the canonical `17`. Pass one
 * and you get one kind of hit. The refName hits come back first and are capped
 * well below the list length, so a scaffold-heavy genome cannot fill the
 * dropdown with scaffolds and push the gene hits off the end.
 *
 * Two orderings matter here, and neither is optional. `waitForAssembly` has to
 * resolve before the scan, because `allRefNames` is a plain getter that returns
 * nothing until the refName aliases have loaded -- reading it early is not an
 * error, it is just an empty answer. And the responses can land out of order:
 * `TP53` fetched over a slower connection than `TP53BP1` typed after it would
 * overwrite the newer list with the older one, which is what `cancelled`
 * prevents. A debounce reduces how often that happens and does not fix it.
 *
 * `useDebounce` is core's, the same one JBrowse's own autocomplete uses. 300ms:
 * long enough that a typed word is one round trip rather than seven.
 */
function useSearchResults(session: BrowserSession, query: string) {
  const [results, setResults] = useState<BaseResult[]>([])
  const [error, setError] = useState<unknown>(undefined)
  const debounced = useDebounce(query.trim(), 300)

  useEffect(() => {
    if (!debounced) {
      setResults([])
      setError(undefined)
      return
    }
    let cancelled = false
    const { assemblyManager, textSearchManager } = session
    assemblyManager
      .waitForAssembly(hg38.name)
      .then(assembly =>
        fetchResults({
          queryString: debounced,
          assemblyName: hg38.name,
          textSearchManager,
          assembly,
        }),
      )
      .then(hits => {
        if (!cancelled) {
          setResults(hits)
          setError(undefined)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResults([])
          setError(e)
        }
      })
    return () => {
      cancelled = true
    }
  }, [session, debounced])

  return { results, error, searching: query.trim() !== debounced }
}

/**
 * The dropdown.
 *
 * A `BaseResult` is deliberately small: `getDisplayString()` is what to show,
 * `getLocation()` the locstring to navigate to, `getTrackId()` the track the hit
 * came from. Only the first is guaranteed. A result can report a location of `''`
 * -- forwarding that into `navToLocString` blanks the view rather than erroring
 * -- and a refName hit carries no track at all, which is why both are checked
 * below rather than passed straight through.
 *
 * Navigating one is the two calls JBrowse itself makes. `showTrack` is second
 * and unconditional-looking, but it returns the existing track if it is already
 * shown, so there is no "is it on" test to write. The `0.2` on the navigation is
 * the padding JBrowse uses for a search hit: a feature framed edge to edge in
 * the viewport is hard to read, and 20% either side is what its own search box
 * gives you.
 *
 * `type="button"` on each row, and the list is a real list. This is a plain
 * demo of the data flow rather than a combobox -- an accessible one owes the
 * reader `role="listbox"`, arrow-key navigation and `aria-activedescendant`,
 * which is a component you have or a library you already use, and none of it
 * changes the two calls at the bottom of the handler.
 *
 * Not an `observer`: a `BaseResult` is a plain object, and the view is only
 * touched from the click handler. Nothing here is read off a model at render
 * time, so a subscription would change nothing.
 */
function ResultList({
  view,
  results,
  onChosen,
}: {
  view: BrowserView
  results: BaseResult[]
  onChosen: () => void
}) {
  return (
    <ul
      data-testid="search-results"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        maxHeight: 132,
        overflowY: 'auto',
        border: '1px solid color-mix(in srgb, CanvasText 25%, Canvas)',
      }}
    >
      {results.map(result => {
        const location = result.getLocation()
        const trackId = result.getTrackId()
        return (
          <li key={result.getId()}>
            <button
              type="button"
              disabled={!location}
              style={{
                font: 'inherit',
                fontSize: '0.8rem',
                display: 'flex',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                padding: '3px 6px',
              }}
              onClick={() => {
                if (!location) {
                  return
                }
                onChosen()
                view
                  .navToLocString(location, hg38.name, 0.2)
                  .then(async () => {
                    if (trackId) {
                      await view.launchTrack(trackId)
                    }
                  })
                  .catch((e: unknown) => {
                    // a hit the index produced that the assembly cannot resolve
                    // is a stale index, not a user error
                    console.error(e)
                  })
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {result.getDisplayString()}
              </span>
              <span style={{ opacity: 0.7 }}>{location || 'no location'}</span>
              {trackId ? (
                <span style={{ opacity: 0.5, marginLeft: 'auto' }}>
                  {trackId}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// Not an `observer` either: the session is read inside `useSearchResults`'
// effect rather than during render, so there is no observable subscription to
// buy.
function SearchPanel({
  view,
  session,
}: {
  view: BrowserView
  session: BrowserSession
}) {
  const [query, setQuery] = useState('BRCA1')
  const { results, error, searching } = useSearchResults(session, query)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width: 380,
        maxWidth: '100%',
      }}
    >
      <input
        aria-label="Search features"
        value={query}
        placeholder="BRCA1, TP53, BRC, chr17…"
        style={{ font: 'inherit', padding: '2px 4px' }}
        onChange={event => {
          setQuery(event.target.value)
        }}
      />
      {error ? (
        <span role="alert" style={{ fontSize: '0.8rem', color: '#d97706' }}>
          {error instanceof Error ? error.message : String(error)}
        </span>
      ) : null}
      {results.length ? (
        <ResultList
          view={view}
          results={results}
          onChosen={() => {
            setQuery('')
          }}
        />
      ) : (
        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
          {!query.trim() ? 'Type a feature or contig name' : null}
          {query.trim() && searching ? 'Searching…' : null}
          {query.trim() && !searching
            ? `Nothing matches “${query.trim()}”`
            : null}
        </span>
      )}
    </div>
  )
}

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing, and for the one the hook writes itself.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
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

const SearchResultsDropdown = observer(function SearchResultsDropdown() {
  const { view, session } = useCreateOnce(makeView)
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  const mode = useSiteMode()

  return (
    <SessionPaletteProvider session={session} mode={mode}>
      <DisplayUIProvider>
        <div style={{ paddingBottom: 8 }}>
          <SearchPanel view={view} session={session} />
        </div>
        <div ref={ref} {...containerProps} style={viewport}>
          {view.status.type === 'ready' ? (
            <TrackRow view={view} trackId="genes" />
          ) : (
            <ViewStatus view={view} />
          )}
        </div>
      </DisplayUIProvider>
    </SessionPaletteProvider>
  )
})

export default SearchResultsDropdown
