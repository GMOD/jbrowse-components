import { Suspense, useState, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// The other direction from the mouse: your app tells the browser where to go
// and what to show, and reads back where it ended up.
//
// Everything below the toolbar is the previous pages. The toolbar is four calls
// -- `navToLocString`, `zoom`, `showTrack`, `hideTrack` -- and one getter,
// `coarseVisibleLocStrings`. None of it is a JBrowse component; the point of
// the page is that driving the view is a normal API, so a location box in your
// app's own header works exactly as well as one inside a genome browser.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

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

const alignmentsTrack = {
  type: 'AlignmentsTrack',
  trackId: 'volvox_bam',
  name: 'Reads',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BamAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam',
  },
  displayDefaults: { height: 150 },
}

// The catalogue the checkboxes render. This is your app's list, not JBrowse's:
// what is *shown* lives on the view (`view.tracks`), and the checkbox state is
// read back off it below rather than kept in React state.
const catalogue = [
  { id: 'volvox_microarray', label: 'Microarray' },
  { id: 'volvox_genes', label: 'Genes' },
  { id: 'volvox_bam', label: 'Reads' },
]

// Somewhere to send the reader that isn't "type a locstring and hope". Real
// apps usually have this list already -- a gene of interest, a saved view, the
// row someone clicked in a table next to the browser.
//
// Both halves of the two-region entry are on ctgA, and that is not incidental:
// this assembly's bigWig only covers ctgA, so a second region on ctgB would
// leave the microarray track blank over half the screen. Two genes on one
// contig is the usual reason to want two regions anyway.
//
// A locstring takes as many regions as you give it, so `Every contig` is the
// same call again. On a real assembly it reads `chr1 chr2 ... chrX chrY`, and
// `view.showAllRegionsInAssembly()` is the same move without spelling them out
// -- though note that on hg38 that call means 455 regions, not 24, because it
// takes every sequence in the file including the _alt and _random scaffolds,
// and all but the chromosomes land sub-pixel.
const bookmarks = [
  { label: 'EDEN', loc: 'ctgA:1,050..9,000' },
  { label: 'A whole contig', loc: 'ctgA' },
  {
    label: 'Two regions at once',
    loc: 'ctgA:1,050..9,000 ctgA:17,400..23,000',
  },
  { label: 'Every contig', loc: 'ctgA ctgB' },
]

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack, featureTrack, alignmentsTrack],
    init: {
      loc: 'ctgA:1..20,000',
      tracks: ['volvox_microarray', 'volvox_genes'],
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

// What each kind of span looks like is yours; that there are three is not. A
// seam must be opaque -- regions are laid out contiguously, so both sides are
// drawn right up to it and a see-through line tints two regions' features
// instead of separating them.
const SPAN_FILL = {
  seam: 'color-mix(in srgb, CanvasText 45%, Canvas)',
  boundary: 'color-mix(in srgb, CanvasText 12%, Canvas)',
  elided: 'color-mix(in srgb, CanvasText 30%, Canvas)',
}

/**
 * Everything along the row that is not track data, which you have to draw.
 *
 * A locstring with two regions in it gives the view two `displayedRegions`, and
 * they are laid out **contiguously** -- no gap, no marker. JBrowse's own
 * boundary is drawn by its track container, not by the display, so a host that
 * mounts `RenderingComponent` directly gets two regions butted edge to edge
 * with nothing to say where one ends. A two-region view then looks like a
 * one-region view that scrolled somewhere strange, which is worth knowing
 * before you conclude the navigation didn't work.
 *
 * `view.paddingSpans` is the geometry, already worked out: `{x, width, kind}`
 * per span, `kind` being `seam` (a region's right edge), `boundary` (past the
 * start of the first region or the end of the last) or `elided` (a region too
 * narrow to draw at this zoom -- see the Every chromosome page, where that is
 * most of a real assembly). Drawing only the seams is the mistake worth naming:
 * it leaves the elided tail of a genome rendering as nothing at all.
 *
 * The x values are in the **staticBlocks frame**, the same one `gridlineTicks`
 * and `scalebarLabels` use -- a pixel space spanning every displayed region
 * rather than the viewport. So one element translated by
 * `view.staticBlocksTranslateX` places every span at once, and a pan moves that
 * one transform. That getter is the frame arithmetic, published: it is the only
 * coordinate conversion on this site you do not get handed.
 *
 * Deriving this yourself off `isRightEndOfDisplayedRegion` is a near miss twice
 * over: `view.scalebarRegionEndPx` looks like the shortcut and is not one (it
 * is the right edge of the blocks *currently loaded*, so inside a region wider
 * than the viewport it slides as you scroll), and the flag is set on elided
 * blocks too, where a bar per region at whole-genome zoom is a solid grey wall.
 *
 * **The one thing this layer must not end up over is the display's own
 * chrome.** A display floats things of its own -- a colour key, hi-c's overlay
 * panel, the loading and error states -- inside a `contain: strict` box, which
 * is its own stacking context, so a layer painted over the stack buries them
 * and no z-index inside that box can win. `TrackRow` above mounts the node they
 * escape into (`TrackOverlaySlot`, at `zIndex: 3`, over these spans at 2), which
 * is what JBrowse's own track container does. Leave it out and nothing errors:
 * the chrome is simply under a grey bar, and at whole-genome zoom, where most
 * spans are elided, under a grey wall. The Track settings page turns a legend on
 * and shows it.
 */
const RegionBoundaries = observer(function RegionBoundaries({
  view,
}: {
  view: BrowserView
}) {
  const { paddingSpans, staticBlocksTranslateX } = view
  return (
    <div
      aria-hidden
      // this site's smoke test checks that a display's own chrome paints above
      // this layer rather than under it, and needs to be able to find the layer.
      // Keep or drop it in your own app -- the check needs it, the technique
      // does not
      data-region-seams
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 2,
        pointerEvents: 'none',
        // boxes, so unrounded: rounding is for text, where a fractional offset
        // blurs a glyph. JBrowse's own PaddingBlocks makes the same call
        transform: `translateX(${staticBlocksTranslateX}px)`,
      }}
    >
      {paddingSpans.map(({ key, x, width, kind }) => (
        <div
          key={key}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: x,
            width,
            background: SPAN_FILL[kind],
          }}
        />
      ))}
    </div>
  )
})

/**
 * A location box.
 *
 * `navToLocString` takes what a user would type -- `ctgA`, `ctgA:1,050..9,000`,
 * two regions separated by a space -- and does the rest: it waits for the
 * assembly, resolves the reference name (including aliases, so `chr1` finds a
 * `1`), replaces `displayedRegions` if the new location needs different ones,
 * and clamps the zoom. It is `async` for the assembly wait, and it **throws**
 * on anything it cannot resolve, so a box that does not catch will look like it
 * silently ignored a typo.
 *
 * The interesting part is which way the value flows. The view is the source of
 * truth, and it moves constantly -- every pan frame changes the location -- so
 * the box shows `coarseVisibleLocStrings`, which recomputes on a 500ms tick
 * rather than per frame. (`visibleLocStrings` is the live one. Rendering *that*
 * into an input re-renders the box on every frame of a drag, for a number no
 * one can read mid-gesture.)
 *
 * While the user is typing, that has to stop: a value arriving from a pan would
 * overwrite what they are halfway through. So a keystroke parks a `draft`, and
 * submitting or escaping drops it, which hands the box back to the view. That
 * is the whole trick to a control that is both live and editable.
 */
const LocationBox = observer(function LocationBox({
  view,
}: {
  view: BrowserView
}) {
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const [error, setError] = useState<unknown>(undefined)
  const shown = view.coarseVisibleLocStrings

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <form
        style={{ display: 'flex', gap: 4 }}
        onSubmit={event => {
          event.preventDefault()
          setError(undefined)
          view
            .navToLocString(draft ?? shown)
            .then(() => {
              setDraft(undefined)
            })
            .catch((e: unknown) => {
              setError(e)
            })
        }}
      >
        <input
          aria-label="Location"
          value={draft ?? shown}
          // wide enough for the two-region locstring, which is the longest
          // thing the buttons beside it can put in here
          size={38}
          style={{
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            padding: '2px 4px',
          }}
          onChange={event => {
            setDraft(event.target.value)
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setDraft(undefined)
              setError(undefined)
            }
          }}
        />
        <button type="submit">Go</button>
      </form>
      {error ? (
        <span role="alert" style={{ fontSize: '0.75rem', color: '#d97706' }}>
          {error instanceof Error ? error.message : String(error)}
        </span>
      ) : null}
    </div>
  )
})

/**
 * Zoom buttons.
 *
 * `zoom(targetBpPerPx)` is the animated one, and it is what the buttons in
 * JBrowse's own header call: it eases to the target over a few frames and
 * yields immediately if anything else moves the view, so a click during a
 * wheel-zoom doesn't fight it. `zoomTo` -- what the wheel handler above uses --
 * is the same move without the animation.
 *
 * Neither needs a range check. The view clamps to `minBpPerPx`/`maxBpPerPx`,
 * which it derives from the assembly, so "zoom out" at the whole-genome end is
 * a no-op rather than an error.
 *
 * Not an `observer`, unlike most components here, and the rule is worth being
 * exact about: `observer` re-renders on the observables a component reads *while
 * rendering*. This one reads `bpPerPx` inside a click handler, which runs long
 * after the render and always sees the current value. Wrapping it would buy a
 * subscription that changes nothing. `TrackToggles` below reads `view.tracks` in
 * its body, so it does need one.
 */
function ZoomButtons({ view }: { view: BrowserView }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => {
          view.zoom(view.bpPerPx * 2)
        }}
      >
        −
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => {
          view.zoom(view.bpPerPx / 2)
        }}
      >
        +
      </button>
    </div>
  )
}

/**
 * Show and hide tracks.
 *
 * `showTrack(trackId)` instantiates the track and its display from the config
 * of that id and appends it to `view.tracks`; `hideTrack(trackId)` removes it,
 * which disposes the display and everything it had on the GPU. Adding a track
 * to the *config* is a separate thing -- these two only turn on what is already
 * declared.
 *
 * The checkbox reads `view.tracks` rather than a `useState` next to it. There
 * is no way for the two to disagree that way, which matters as soon as anything
 * else can show a track: a bookmark that arrives with its own track list, a
 * saved session, a second panel in your app.
 */
const TrackToggles = observer(function TrackToggles({
  view,
}: {
  view: BrowserView
}) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: '0.85rem' }}>
      {catalogue.map(({ id, label }) => {
        const shown = view.tracks.some(t => t.configuration.trackId === id)
        return (
          <label
            key={id}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <input
              type="checkbox"
              checked={shown}
              onChange={() => {
                if (shown) {
                  view.hideTrack(id)
                } else {
                  view.showTrack(id)
                }
              }}
            />
            {label}
          </label>
        )
      })}
    </div>
  )
})

/**
 * Jump somewhere, and bring a track list with you.
 *
 * Two calls in one handler, and the order matters only in that `showTrack` is
 * synchronous while `navToLocString` is not -- so the tracks are up before the
 * navigation resolves, and they fetch once, for the destination, rather than
 * once for here and again for there.
 *
 * The `.catch` logs rather than showing the reader anything, which is the
 * opposite of `LocationBox` above and is deliberate: these locstrings are your
 * own, so one that fails to resolve is a bug in your list rather than something
 * a user mistyped. Not an `observer` -- see `ZoomButtons`.
 */
function Bookmarks({ view }: { view: BrowserView }) {
  return (
    <div style={{ display: 'flex', gap: 4, fontSize: '0.85rem' }}>
      {bookmarks.map(({ label, loc }) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            if (
              !view.tracks.some(t => t.configuration.trackId === 'volvox_genes')
            ) {
              view.showTrack('volvox_genes')
            }
            view.navToLocString(loc).catch((e: unknown) => {
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

const DriveItFromYourApp = observer(function DriveItFromYourApp() {
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
            alignItems: 'flex-start',
            gap: 12,
            paddingBottom: 8,
          }}
        >
          <LocationBox view={view} />
          <ZoomButtons view={view} />
          <Bookmarks view={view} />
          <TrackToggles view={view} />
        </div>
        <div ref={ref} {...containerProps} style={viewport}>
          {/* `RegionBoundaries` is inside the same gate as the tracks, not
           * beside it: `staticBlocks` reads `view.width`, which *throws*
           * ("make sure to check for model.initialized") until the
           * ResizeObserver has reported one. A ready `view.status` is that
           * guard, and anything of your own reading block geometry needs it
           * too. */}
          {view.status.type === 'ready' ? (
            <>
              {view.tracks.map(track => (
                <TrackRow
                  key={track.configuration.trackId}
                  view={view}
                  trackId={track.configuration.trackId}
                />
              ))}
              <RegionBoundaries view={view} />
            </>
          ) : (
            <ViewStatus view={view} />
          )}
        </div>
      </DisplayUIProvider>
    </SessionPaletteProvider>
  )
})

export default DriveItFromYourApp
