import { Suspense, useSyncExternalStore } from 'react'

import {
  PaletteProvider,
  usePalette,
  useSessionPalette,
} from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider } from '@jbrowse/display-ui'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// A whole-genome view is not a mode. It is the same view with 24 displayed
// regions instead of one, and everything else on this site applies unchanged.
//
// Two pieces of chrome stop being optional at this width, and both are yours:
// the seam between regions (see the Drive it from your app page) and the name
// on each one, because 24 unlabelled bands are not a genome.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

const hg38 = {
  name: 'hg38',
  uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
  // this file names its sequences `1`, `2`, ... and the list below asks for
  // `chr1`, `chr2`, ...; the alias table is what makes those the same sequence
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
  },
}

// Spelled out rather than asked for, and that is the whole trick.
// `view.showAllRegionsInAssembly()` is the call that *sounds* right here, but
// hg38 has 455 sequences in it -- every `_alt`, `_random` and `chrUn_` scaffold
// -- and all but these 24 land sub-pixel and elide into a grey smear. A
// reference genome's "chromosomes" are a subset a human chose; no file records
// which ones they are.
const CHROMOSOMES = [
  ...Array.from({ length: 22 }, (_, i) => `chr${i + 1}`),
  'chrX',
  'chrY',
]

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

const CHROM_STRIP_HEIGHT = 18

function makeView() {
  const state = createViewState({
    assembly: hg38,
    tracks: [conservationTrack],
    init: {
      // A locstring takes as many regions as you give it, and `init.loc` hands
      // whatever you write here straight to `navToLocString`. `init` also accepts
      // `displayedRegionNames: CHROMOSOMES` for the same result without the join.
      loc: CHROMOSOMES.join(' '),
      tracks: ['hg38_phylop'],
    },
  })
  const { view } = state.session
  // see the Pan and zoom example: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
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

/**
 * The name on each region, from `view.scalebarRefNameLabels`. See the Scalebar
 * page for the three rules inside it. Two of them show up here rather than
 * there: the label of the chromosome you are inside stays pinned to the left
 * edge as you pan past its start, and the narrowest few bands lose their name
 * entirely rather than abbreviate it -- `chr16` clipped to its own width reads
 * as `chr1`, a different chromosome rather than a shortened one, and `2…` on
 * two adjacent bands says nothing at all.
 *
 * That is JBrowse's own rule, so this page draws what the product draws. It is
 * a real trade against the lead above: a band with no name is honest, and it is
 * still a band with no name. Zooming in gives it back.
 */
const RegionNames = observer(function RegionNames({
  view,
}: {
  view: BrowserView
}) {
  const palette = usePalette()
  return view.scalebarRefNameLabels.labels.map(
    ({ key, text, transform, maxWidth, paddingLeft }) => (
      <span
        key={key}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translateX(${transform}px)`,
          maxWidth,
          paddingLeft,
          // maxWidth is the label's whole box, paddingLeft included -- the fit
          // test above measured it that way. Under content-box the padding
          // comes off the text twice and every name wide enough to need the
          // space is clipped mid-glyph.
          boxSizing: 'border-box',
          background: palette.background.paper,
          color: palette.text.primary,
          fontWeight: 'bold',
          // clip, not ellipsis: a name that would not fit whole was already
          // dropped, so there is nothing left to abbreviate
          overflow: 'clip',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    ),
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

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing and which half of it the hook cannot do for you.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  touchAction: 'none',
  cursor: 'grab',
}

const EveryChromosome = observer(function EveryChromosome() {
  const { view, session } = useCreateOnce(makeView)
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  const palette = useSessionPalette(session, useSiteMode())

  return (
    <PaletteProvider palette={palette}>
      <DisplayUIProvider>
        <div ref={ref} {...containerProps} style={viewport}>
          {/* both overlays read block geometry, which throws until the
           * ResizeObserver has reported a width -- see the Drive it from
           * your app page */}
          {view.ready ? (
            <>
              <div
                style={{
                  position: 'relative',
                  height: CHROM_STRIP_HEIGHT,
                  fontSize: '0.7rem',
                  lineHeight: `${CHROM_STRIP_HEIGHT}px`,
                  overflow: 'clip',
                }}
              >
                <RegionNames view={view} />
              </div>
              <TrackRow view={view} trackId="hg38_phylop" />
              <RegionBoundaries view={view} />
            </>
          ) : (
            <ViewStatus view={view} />
          )}
        </div>
      </DisplayUIProvider>
    </PaletteProvider>
  )
})

export default EveryChromosome
