import { Suspense, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import { pickColorOptions } from '@jbrowse/plugin-alignments'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'

// Every page so far drives the *view* -- where it is, how far in, which tracks
// are on. This one goes one level down and drives a **display**: how a track
// paints what it already fetched.
//
// The whole integration is a getter and an action on the display model.
// `display.colorBy` is what it is coloring by now, `setColorScheme({type})`
// changes it, and the labels come from `pickColorOptions`, which is JBrowse's
// own registry of schemes -- so a menu you build cannot drift from the schemes
// that exist, and you do not re-spell "Insert size and pair orientation" in
// your app.
//
// It is also the page where something appears that you did not draw. Tick
// **Show legend** on a scheme that has a key and one shows up in the corner,
// drawn by JBrowse rather than by this file: a display draws its own floating
// chrome, and unlike the loading and error states there is no provider to swap
// it for yours. Two conditions, not one -- the legend is opt-in, and a scheme
// has to have a key to show. `LegendToggle` is the first, and is a setting like
// the others.
//
// That chrome is drawn inside the display's own stacking context, so it cannot
// paint above the region seams this page draws over the stack -- there are two
// regions below, so there is a seam to be buried under. `TrackOverlaySlot` in
// `TrackRow` is what lifts it clear, and it is the same component JBrowse's own
// track container mounts. Every page here mounts it; this is the only one where
// you can watch what it is for.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

const volvox = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
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

// The schemes this page offers, and the labels come from JBrowse rather than
// from here. `pickColorOptions` takes the ones you support, in the order you
// want them, and returns `{type, label}` with each label read out of the same
// registry the track menu uses -- so a menu you build says what JBrowse says,
// and a `type` that is not a real scheme does not compile.
//
// Five of about fourteen. A curated subset is the normal case for an embed:
// the full list includes per-base modes that want a different zoom and tag
// modes that want a tag name, and offering everything is how you end up
// shipping a menu item that does nothing on your data.
//
// **A key lists the colours actually painted, not every colour the scheme
// could paint.** It is derived from the reads laid out in the window, so what
// it says depends on the data in front of you: on this BAM `strand` splits the
// pileup in two and `mappingQuality` comes out a three-step ramp, while a
// scheme whose categories are all absent here collapses to a single row. That
// is the honest rendering rather than a shortcoming, and switching between
// them with the legend on is the second half of what this page shows.
const COLOR_SCHEMES = pickColorOptions(
  'normal',
  'strand',
  'pairOrientation',
  'insertSizeAndOrientation',
  'mappingQuality',
)

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [alignmentsTrack],
    init: {
      // Close enough in that reads are individually visible -- a colour scheme
      // you cannot see one read of is not a demo of a colour scheme -- and two
      // regions rather than one, so there is a seam for the legend to have to
      // paint above. Both on ctgA, which is where this BAM's reads are.
      loc: 'ctgA:1..8,000 ctgA:12,000..20,000',
      tracks: [alignmentsTrack.trackId],
    },
  })
  const { view } = state.session
  // see the Pan and zoom example: scroll-to-zoom is a session preference, and the
  // pileup below reads the same one to know the plain wheel is spoken for
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']

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

/**
 * The same `TrackRow` every page here writes, and this is the page where the
 * one part of it that looks like ceremony stops being invisible.
 *
 * The problem is a stacking context. `contain: strict` is what stops a display
 * painting over its neighbours, and it seals the display's React tree into its
 * own stacking context as a side effect -- so the legend below, which the
 * display draws, cannot out-z-index the seams this page draws over the stack at
 * `zIndex: 2`. Nothing errors. The legend is simply under a grey bar, and at
 * whole-genome zoom, where most spans are elided, under a grey wall.
 *
 * `TrackOverlaySlot` is the way out and it is the same component JBrowse's own
 * track container mounts: the display's box, plus an overlay node *beside* the
 * sandbox rather than inside it, published to the display through
 * `TrackOverlayContext`. Chrome that calls `TrackOverlayPortal` -- the colour
 * key, hi-c's overlay panel, maf's row labels, and the loading and error states
 * every display has -- lands in that node and paints at the `zIndex` you give
 * it. With no slot the context is null, the portal falls back to rendering in
 * place, and the chrome is back inside the sandbox with nothing to say so.
 *
 * So it goes on every page rather than on this one, which is the only page that
 * can *show* it: nothing else here turns on a colouring that has a key. A host
 * whose displays are quiet today and whose layout grows a mask tomorrow gets no
 * warning either way.
 *
 * **`zIndex` has no default, and that is deliberate.** It is the answer to
 * "above what?", which is a fact about your layout: 3 here, because the seams
 * are at 2. JBrowse's own container passes 100, positioned against its own
 * stacking, and inheriting that number would be right once and quietly wrong
 * everywhere else.
 *
 * The `contain: strict` box is `position: absolute; inset: 0` inside the slot's
 * box rather than being the sized box itself, because the slot owns the height
 * -- exactly what `TrackRenderingContainer` does inside JBrowse.
 */
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
 * The spans along the row that are not track data -- region seams, the greyed
 * ends of the genome, and regions too narrow to draw. `view.paddingSpans` is
 * the geometry; see the Drive it from your app page for the frame it is in and
 * for why deriving it yourself misses two cases.
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
 * The whole of it: read `display.colorBy`, call `display.setColorScheme`.
 *
 * `activeDisplay` is a pluggable MST type resolved at runtime, so there is no
 * static element type on `getTrack` to narrow it -- the assertion to the
 * published `LinearAlignmentsDisplayModel` is what gives the two members below
 * their types. It is an assertion rather than a check because this page put the
 * track in the config itself and knows what it is; a host whose tracks come from
 * a config file it did not write should test `type` on the track config first.
 *
 * **A `<select>`, not React state.** The value is read back off the model on
 * every render, so there is nothing here that can disagree with the display --
 * which matters as soon as anything else can set a scheme, and something else
 * always can: the track's own right-click menu sets exactly this field, and a
 * saved session arrives with it already set.
 *
 * `setColorScheme` is one action rather than a `setConf`, and the difference is
 * not cosmetic: it also clears the map of discovered per-read values that the
 * CPU-baked schemes fill in, which a bare config write would leave stale
 * against the new scheme.
 */
const ColorBySelect = observer(function ColorBySelect({
  view,
  trackId,
}: {
  view: BrowserView
  trackId: string
}) {
  const display = view.getTrack(trackId)?.activeDisplay as
    | LinearAlignmentsDisplayModel
    | undefined
  if (!display) {
    return null
  }
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      Color by
      <select
        value={display.colorBy.type}
        style={{ font: 'inherit', padding: '2px 4px' }}
        onChange={event => {
          display.setColorScheme({
            // the option values ARE the scheme types, so this is the registry's
            // own vocabulary round-tripping through the DOM rather than a
            // string this file invented
            type: event.target.value as (typeof COLOR_SCHEMES)[number]['type'],
          })
        }}
      >
        {COLOR_SCHEMES.map(({ type, label }) => (
          <option key={type} value={type}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
})

/**
 * The legend is a setting too, and it is off by default.
 *
 * Worth a control of its own because the default surprises people: pick a
 * scheme with a key and nothing appears, because a legend eagerly covering the
 * top of every alignments track is worse than one you ask for.
 * `setShowLegend(true)` is the ask.
 *
 * **Read it back through `display.showLegend`, never `getConf`.** It is a
 * *promotable* slot: unset means "follow the session-wide default for this
 * display type", and only the resolved getter knows what that came out as. The
 * raw config value for an untouched track is `undefined`, which as a checkbox
 * state reads as "off" whether or not the session turned it on. `setShowLegend`
 * also takes `undefined`, which puts a track back to inheriting -- that is what
 * a tri-state control would write, and this checkbox does not offer it.
 *
 * Once it is on, the legend's own `×` writes the same slot. Nothing here is
 * told; the checkbox goes back to unticked because it reads the model.
 */
const LegendToggle = observer(function LegendToggle({
  view,
  trackId,
}: {
  view: BrowserView
  trackId: string
}) {
  const display = view.getTrack(trackId)?.activeDisplay as
    | LinearAlignmentsDisplayModel
    | undefined
  if (!display) {
    return null
  }
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="checkbox"
        checked={display.showLegend}
        onChange={event => {
          display.setShowLegend(event.target.checked)
        }}
      />
      Show legend
    </label>
  )
})

/**
 * A second setting, to show that the first was not special.
 *
 * `display.setFeatureHeight(px)` is how tall one read is drawn. Nothing about
 * it is alignments-specific in shape -- it is the same pattern as the colour
 * scheme, a getter to read and an action to write -- which is the point of
 * having two on one page: a display's settings are an ordinary model API, not a
 * menu you have to reach into.
 *
 * The display re-lays out and re-renders on its own; there is no invalidate
 * call, and no reason to touch `view`.
 */
const ReadHeightControl = observer(function ReadHeightControl({
  view,
  trackId,
}: {
  view: BrowserView
  trackId: string
}) {
  const display = view.getTrack(trackId)?.activeDisplay as
    | LinearAlignmentsDisplayModel
    | undefined
  if (!display) {
    return null
  }
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      Read height
      <input
        type="range"
        min={2}
        max={12}
        step={1}
        value={display.featureHeight}
        style={{ width: 90 }}
        onChange={event => {
          display.setFeatureHeight(Number(event.target.value))
        }}
      />
      <span style={{ opacity: 0.7, minWidth: '3ch' }}>
        {display.featureHeight}px
      </span>
    </label>
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

const TrackSettings = observer(function TrackSettings() {
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
            gap: 16,
            fontSize: '0.85rem',
            paddingBottom: 8,
          }}
        >
          {/* Both controls are outside the `view.ready` gate on purpose: they
           * read the *display*, which exists as soon as the track does, and each
           * returns null until then. Putting them inside would make the toolbar
           * appear a beat after the box, which is the kind of jump the reserved
           * demo height exists to avoid. */}
          <ColorBySelect view={view} trackId={alignmentsTrack.trackId} />
          <LegendToggle view={view} trackId={alignmentsTrack.trackId} />
          <ReadHeightControl view={view} trackId={alignmentsTrack.trackId} />
        </div>
        <div ref={ref} {...containerProps} style={viewport}>
          {/* `RegionBoundaries` reads block geometry, which throws until the
           * ResizeObserver has reported a width, so it sits inside the same
           * gate as the track. See the Drive it from your app page. */}
          {view.ready ? (
            <>
              <TrackRow view={view} trackId={alignmentsTrack.trackId} />
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

export default TrackSettings
