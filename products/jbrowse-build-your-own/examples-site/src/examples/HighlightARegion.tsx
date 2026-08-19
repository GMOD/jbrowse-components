import { Suspense, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { HighlightType } from '@jbrowse/core/util/highlights'

// The archetypal embed: a table, a search result or a variant report links into
// a browser, and the region it linked to has to be visible once you get there.
// Navigating is not enough -- the reader lands on a window of sequence with no
// mark on the thing they clicked.
//
// `view.highlight` is that mark, and like everything else on this site it is
// data rather than a component: an array of `{refName, start, end, color?,
// label?}`, and `view.getHighlightCoords(h)` turns one into the `{left, width}`
// to draw a band at. What the band looks like is yours.
//
// The four things that method knows, each of which is a bug you would otherwise
// ship once, are in `Highlights` below.
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
  displayDefaults: { height: 140 },
}

// Whatever your app already has a list of: search hits, a variant report, the
// row someone clicked in a table beside the browser. `color` is optional and
// overrides the theme's default band; a user-supplied one is used as-is, so an
// explicit alpha survives.
const HITS: { label: string; loc: string; highlight: HighlightType }[] = [
  {
    label: 'EDEN',
    loc: 'ctgA:1,000..9,500',
    highlight: {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 1049,
      end: 9000,
      label: 'EDEN',
    },
  },
  {
    label: 'A single base',
    loc: 'ctgA:1..40,000',
    highlight: {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 20000,
      end: 20001,
      color: 'rgba(217, 119, 6, 0.45)',
      label: 'one base, 40kb out',
    },
  },
  {
    label: 'Off the end of the contig',
    loc: 'ctgA:45,000..50,001',
    highlight: {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 48000,
      end: 60000,
      label: 'clipped to the contig',
    },
  },
]

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [featureTrack],
    // `location` and `highlight` are top-level options, so a browser can arrive
    // already marked rather than being navigated after it mounts. Both are
    // sugar for fields of the same declarative `init` the buttons below drive
    // imperatively, which is what makes the two paths agree -- and mixing them
    // with an `init` of your own is fine, since the sugar only fills in the two
    // fields it names.
    location: HITS[0]!.loc,
    highlight: [HITS[0]!.highlight],
    init: { tracks: [featureTrack.trackId] },
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
 * The bands.
 *
 * `view.getHighlightCoords(region)` is the whole geometry: `{left, width}`, or
 * `undefined` when the region is nowhere on screen. Four things live inside it,
 * and each is a bug that only shows up on the awkward input:
 *
 * - **it clips to the displayed regions.** A highlight that runs off the end of
 *   a contig -- because your source rounded, or because the region came from a
 *   different assembly build -- is trimmed rather than drawn into the greyed
 *   area past the genome's end. The third button does this.
 * - **width has a 3px floor.** A one-base highlight at 40kb of zoom is a
 *   hundredth of a pixel, so the honest rendering of it is nothing at all. The
 *   second button is that case, and the band stays findable.
 * - **it is independent of direction.** A reversed displayed region makes the
 *   end map left of the start; the returned `width` is an absolute value and
 *   `left` the smaller of the two, so a band never renders inside-out.
 * - **it resolves the refName the way the view does.** A highlight naming
 *   `chr1` still lands on an assembly whose sequence file calls it `1`, which
 *   matters because these regions usually come from somewhere else.
 *
 * **Viewport pixels, not the staticBlocks frame.** `left` is already net of
 * `offsetPx`, so these go in a plain container -- unlike `paddingSpans` and
 * `gridlineTicks`, which are laid out across every displayed region and need
 * `view.staticBlocksTranslateX` on a wrapper. Two frames on one row is the
 * thing to keep straight; `scalebarRefNameLabels` is in this one too.
 */
const Highlights = observer(function Highlights({
  view,
  session,
}: {
  view: BrowserView
  session: BrowserSession
}) {
  // Session-wide, not per view, and on by default. Worth reading even if you
  // draw no control for it, because something else in your app might: a band
  // that renders unconditionally would ignore the toggle.
  //
  // JBrowse re-reveals on *growth* -- an autorun on `highlight.length` -- so
  // `addToHighlights` while the toggle is off turns it back on rather than
  // dropping the band silently. `setHighlight` replacing a one-entry set with
  // another one-entry set is not growth and does not, which is the buttons
  // above: turn the box off, click one, and nothing appears. That is the
  // trade-off for a toggle that can be turned off at all.
  if (!session.highlightsVisible) {
    return null
  }
  return view.highlight.map((highlight, i) => {
    const coords = view.getHighlightCoords(highlight)
    return coords ? (
      <div
        // highlights have no id and can legitimately duplicate, so the index
        // only breaks ties between otherwise-identical regions
        // eslint-disable-next-line @eslint-react/no-array-index-key -- ^ that tie-break is the point; without it two identical regions share a key
        key={`${highlight.refName}-${highlight.start}-${i}`}
        // this site's smoke test clicks the buttons above and measures the
        // band, because the three cases the method survives are invisible until
        // something drives them. Keep or drop it in your own app -- the demo
        // needs it, the technique does not
        data-testid="highlight-band"
        title={highlight.label}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: coords.left,
          width: coords.width,
          zIndex: 3,
          // a band is a mark on the data, not a lid over it: it must not take
          // the click a display underneath is waiting for
          pointerEvents: 'none',
          background:
            highlight.color ??
            'color-mix(in srgb, CanvasText 18%, transparent)',
        }}
      />
    ) : null
  })
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
 * Arriving from somewhere else, which is what this whole page is about.
 *
 * `setHighlight(list)` replaces the set, `addToHighlights(one)` appends. This
 * uses the first, because each button *is* the one thing the reader followed;
 * an app showing several hits at once appends instead.
 *
 * The highlight is set before the navigation rather than after, and not for a
 * correctness reason -- `navToLocString` is async, so setting it after would
 * leave the band absent for the whole of the fetch. Neither call waits on the
 * other: a highlight for a region that is not on screen simply has no
 * coordinates yet, and `getHighlightCoords` returns `undefined` until it does.
 *
 * Not an `observer`, unlike most components here: `observer` subscribes to the
 * observables a component reads *while rendering*, and this one touches the
 * view only from a click handler, which always sees the current value anyway.
 */
function HitList({ view }: { view: BrowserView }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: '0.85rem' }}>
      {HITS.map(({ label, loc, highlight }) => (
        <button
          key={label}
          type="button"
          style={{ font: 'inherit' }}
          onClick={() => {
            view.setHighlight([highlight])
            view.navToLocString(loc).catch((e: unknown) => {
              // these locstrings are your own, so one that fails to resolve is
              // a bug in your list rather than something a user mistyped
              console.error(e)
            })
          }}
        >
          {label}
        </button>
      ))}
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

const HighlightARegion = observer(function HighlightARegion() {
  const { view, session } = useCreateOnce(makeView)
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  const mode = useSiteMode()

  return (
    <SessionPaletteProvider session={session} mode={mode}>
      <DisplayUIProvider>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 14,
            paddingBottom: 8,
          }}
        >
          <HitList view={view} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input
              type="checkbox"
              checked={session.highlightsVisible}
              onChange={event => {
                session.setHighlightsVisible(event.target.checked)
              }}
            />
            <span style={{ fontSize: '0.85rem' }}>
              Show highlights — session-wide, across every view
            </span>
          </label>
        </div>
        <div ref={ref} {...containerProps} style={viewport}>
          {/* `getHighlightCoords` reads block geometry, which throws until the
           * ResizeObserver has reported a width -- so the bands sit inside the
           * same gate as the tracks. See the Drive it from your app page. */}
          {view.status.type === 'ready' ? (
            <>
              <TrackRow view={view} trackId="volvox_genes" />
              <Highlights view={view} session={session} />
            </>
          ) : (
            <ViewStatus view={view} />
          )}
        </div>
      </DisplayUIProvider>
    </SessionPaletteProvider>
  )
})

export default HighlightARegion
