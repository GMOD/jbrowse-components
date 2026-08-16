import { Suspense, useRef, useSyncExternalStore } from 'react'

import {
  PaletteProvider,
  useSessionPalette,
} from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider } from '@jbrowse/display-ui'
import {
  LevelSyntenyCanvas,
  type LinearSyntenyViewModel,
} from '@jbrowse/plugin-linear-comparative-view'
import { createViewState } from '@jbrowse/react-app2'
import { observer } from 'mobx-react'

// Human and mouse at BRCA1, one above the other, and the ribbons that say which
// piece of one is which piece of the other. Drag either row -- they move
// independently, and the ribbons follow.
//
// The thing worth noticing is how little of this is new. A synteny view is a
// view whose `views` are **ordinary linear genome views**, so every page before
// this one applies to each row unchanged: `useWidthSetter`, `usePanZoom`,
// `getTrack(id).activeDisplay.RenderingComponent`. What the synteny view adds is
// `levels` -- one band between each pair of rows -- and the band is a component
// over a model like everything else.
//
// The engine comes from a DIFFERENT published package here, and that is the
// whole reason this page exists at the end. `@jbrowse/react-linear-genome-view2`,
// which every other page uses, has a session with exactly one view slot, welded
// to `LinearGenomeView` -- deliberately, since it is the single-view product.
// Two views need a session with a views *array*, and that is
// `@jbrowse/react-app2`. Nothing else about the technique changes; if you have
// read the pages above, you can already read the rest of this file.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

// Human and mouse, ~90 My apart. Only the chromosome names are needed to lay
// out a coordinate space, so the assemblies are `.chrom.sizes` rather than a
// FASTA -- there is no base-level zoom on this page, and skipping the sequence
// keeps two whole genomes cheap.
const assemblies = [
  {
    name: 'hg38',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'hg38-ref',
      adapter: {
        type: 'ChromSizesAdapter',
        uri: 'https://jbrowse.org/ucsc/hg38/hg38.chrom.sizes',
      },
    },
  },
  {
    name: 'mm39',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'mm39-ref',
      adapter: {
        type: 'ChromSizesAdapter',
        uri: 'https://jbrowse.org/ucsc/mm39/mm39.chrom.sizes',
      },
    },
  },
]

// UCSC's hg38->mm39 liftOver chain, converted to PIF: a PAF sorted and indexed
// on both sides, so the view fetches only the alignments over the window
// instead of reading the whole file into memory. That is the difference between
// this and `PAFAdapter`, and it is what makes a whole-genome alignment usable
// as a track -- `jbrowse make-pif` produces one from any PAF.
//
// Note the two `assemblyNames`. The track's says which pair of rows it can sit
// between; the adapter's is [query, target] and says which way round the file
// is written.
const syntenyTrack = {
  type: 'SyntenyTrack',
  trackId: 'hg38_mm39',
  name: 'Human vs mouse (UCSC liftOver)',
  assemblyNames: ['hg38', 'mm39'],
  adapter: {
    type: 'PairwiseIndexedPAFAdapter',
    uri: 'https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz',
    // the index is a .csi beside the file, not the .tbi the shorthand assumes
    csi: true,
    assemblyNames: ['mm39', 'hg38'],
  },
}

// One gene track per row -- ordinary feature tracks, nothing comparative about
// them. A row is just a linear genome view, so this is the same track config it
// was five pages ago; the only reason there are two is that there are two
// genomes.
const geneTracks = [
  {
    type: 'FeatureTrack',
    trackId: 'hg38_genes',
    name: 'RefSeq curated (human)',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
      csi: true,
    },
    // One transcript per gene, on both rows. `auto` would pick this at
    // whole-genome zoom and `all` here, and `all` is the wrong answer for a
    // comparison: human BRCA1 has an order of magnitude more annotated
    // isoforms than mouse Brca1, so the rows would differ in height for a
    // reason that is about annotation depth rather than about the genes.
    displayDefaults: { height: 110, geneGlyphMode: 'longestCoding' },
  },
  {
    type: 'FeatureTrack',
    trackId: 'mm39_genes',
    name: 'RefSeq curated (mouse)',
    assemblyNames: ['mm39'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/ucsc/mm39/ncbiRefSeqCurated.gff.gz',
      csi: true,
    },
    // One transcript per gene, on both rows. `auto` would pick this at
    // whole-genome zoom and `all` here, and `all` is the wrong answer for a
    // comparison: human BRCA1 has an order of magnitude more annotated
    // isoforms than mouse Brca1, so the rows would differ in height for a
    // reason that is about annotation depth rather than about the genes.
    displayDefaults: { height: 110, geneGlyphMode: 'longestCoding' },
  },
]

// BRCA1, and its mouse ortholog Brca1. Coordinates are the RefSeq curated spans
// plus a little air: hg38 chr17:43,044,295-43,125,364 and mm39
// chr11:101,379,590-101,442,781.
//
// The gene is the point of opening here rather than at whole-genome zoom. At
// ~90 My the liftOver chain has nothing to say about most of an intron, so the
// ribbons collapse onto the coding exons -- the alignment picks out exactly the
// part of the gene that had to stay put, against a human copy ~25% longer than
// the mouse one.
const HUMAN_LOC = 'chr17:43,040,000..43,130,000'
const MOUSE_LOC = 'chr11:101,375,000..101,447,000'

/**
 * `createViewState` from the app product takes its config in one blob and
 * builds the session from `defaultSession`, rather than the single-view
 * product's `setInit` on a view that already exists. Same idea, one level up:
 * declare what you want and let the engine resolve assemblies in the right
 * order.
 *
 * `init` on the view snapshot is the synteny view's own version of `setInit`:
 * per row an assembly, where to open it and which tracks to show, and per band
 * which synteny track goes in it. The view resolves both assemblies first, then
 * builds a linear genome view for each row -- so a row arrives already at its
 * gene, rather than at the whole genome and then navigating.
 */
function makeView() {
  const state = createViewState({
    config: {
      assemblies,
      tracks: [syntenyTrack, ...geneTracks],
      defaultSession: {
        name: 'synteny',
        views: [
          {
            type: 'LinearSyntenyView',
            init: {
              views: [
                {
                  assembly: 'hg38',
                  loc: HUMAN_LOC,
                  tracks: ['hg38_genes'],
                },
                {
                  assembly: 'mm39',
                  loc: MOUSE_LOC,
                  tracks: ['mm39_genes'],
                },
              ],
              tracks: ['hg38_mm39'],
              // Bezier ribbons rather than straight chords. Two rows opened at
              // orthologous genes are offset from each other, so every chord
              // runs at a slant; curves leave the two ends vertical and only
              // bend in the middle, which is what makes a stack of them
              // readable instead of a hatch pattern.
              drawCurves: true,
              // 'matches' leaves the indel wedges see-through and paints only
              // the aligned runs. Human BRCA1 is ~25% longer than the mouse
              // copy, so at 'full' the wedges for that extra sequence are the
              // largest coloured areas on screen and the conserved exons --
              // the thing worth seeing -- are the thin bits between them.
              cigarMode: 'matches',
            },
          },
        ],
      },
    },
  })
  // see the Pan and zoom example: scroll-to-zoom is a session preference, so
  // this one call covers both rows and the band between them
  state.session.setScrollZoom(true)
  // `views` is a pluggable MST array, so its element type is resolved at
  // runtime and there is nothing narrower than this to assert. The published
  // `LinearSyntenyViewModel` is the type to assert to.
  return {
    session: state.session,
    view: state.session.views[0] as LinearSyntenyViewModel,
  }
}

type SyntenyView = ReturnType<typeof makeView>['view']
type BrowserView = SyntenyView['views'][number]

// The shape this file uses off a band's displays, written out rather than
// imported. A level's displays are an MST array of pluggable types resolved at
// runtime, so there is no static element type to name -- JBrowse's own
// comparative render area declares the same little interface for the same
// reason.
interface SyntenyDisplay {
  id: string
  RenderingComponent: React.FC<{ model: SyntenyDisplay }>
}

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

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing and which half of it the hook cannot do for you. One
// per row here, which is what lets the rows move independently.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  touchAction: 'none',
  cursor: 'grab',
}

/**
 * One genome row.
 *
 * `usePanZoom` is bound per row, against that row's own view, which is what
 * makes the rows move independently -- the gesture layer never knew about
 * synteny and does not need to. The width is NOT set here: the synteny view
 * takes one width and fans it out to every row, so there is a single
 * `useWidthSetter` at the bottom of this file rather than one per row.
 */
const SyntenyRow = observer(function SyntenyRow({
  view,
  label,
}: {
  view: BrowserView
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { containerProps } = usePanZoom(ref, view)
  return (
    <div ref={ref} {...containerProps} style={viewport}>
      <div
        style={{
          fontSize: '0.7rem',
          opacity: 0.7,
          padding: '2px 4px',
          userSelect: 'none',
        }}
      >
        {label}
      </div>
      {view.ready
        ? view.tracks.map(track => (
            <TrackRow
              key={track.configuration.trackId}
              view={view}
              trackId={track.configuration.trackId}
            />
          ))
        : null}
    </div>
  )
})

/**
 * The band between two rows.
 *
 * `LevelSyntenyCanvas` is the ribbon layer, and it is the one piece of this
 * page you could not write yourself: it drives the same GPU rendering backend
 * the rest of JBrowse draws with, so a hand-rolled substitute would be a worse
 * copy of the engine rather than chrome of your own. It is absolutely
 * positioned, so the band owns the height -- `level.height`, not whatever
 * happens to be drawn in it.
 *
 * The per-display `RenderingComponent` on top is the interactive half: the
 * tooltip, the right-click menu and the fetch status. It comes off the display
 * model rather than an import, exactly like a track's does. Its layer takes no
 * pointer events except where those states put them back.
 */
const Ribbons = observer(function Ribbons({
  level,
}: {
  level: SyntenyView['levels'][number]
}) {
  return (
    <div style={{ position: 'relative', height: level.height }}>
      <LevelSyntenyCanvas model={level} />
      {(level.linearSyntenyDisplays as SyntenyDisplay[]).map(display => (
        <div
          key={display.id}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <Suspense fallback={null}>
            <display.RenderingComponent model={display} />
          </Suspense>
        </div>
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

// JBrowse's stock displays read a palette to colour their own *content*: the
// feature display wants a highlight colour, the synteny display wants its
// ribbon fills. That is a palette of colour strings, not a UI toolkit, so it
// arrives through `PaletteProvider` and Material UI is not involved.
//
// One call covers both rows and the band between them. The palette is
// session-wide, and a synteny view's rows are ordinary linear genome views
// sharing this session -- not separately themed browsers.

const SyntenyRibbons = observer(function SyntenyRibbons() {
  const { view, session } = useCreateOnce(makeView)
  const palette = useSessionPalette(session, useSiteMode())
  // One measurement for the whole stack: `setWidth` on the synteny view assigns
  // it to every row, so the rows cannot disagree about how wide they are.
  const ref = useWidthSetter(view)

  return (
    <PaletteProvider palette={palette}>
      <DisplayUIProvider>
        <div ref={ref}>
          {view.initialized ? (
            view.views.map((row, i) => (
              <div key={row.id}>
                {i > 0 ? <Ribbons level={view.levels[i - 1]} /> : null}
                <SyntenyRow
                  view={row}
                  label={row.assemblyNames[0] ?? `row ${i + 1}`}
                />
              </div>
            ))
          ) : (
            // `initialized` waits on every row's view, so a failure in either
            // assembly leaves it false permanently -- the synteny twin of the
            // `view.ready` hole the Loading and error states page is about, and
            // the reason `error` is checked here rather than assuming the only
            // reason not to be initialized is that it is still loading. This
            // view's `error` folds in its rows' for exactly that.
            <div style={{ fontSize: '0.85rem', opacity: 0.7, padding: 8 }}>
              {view.error
                ? `Could not load: ${view.error instanceof Error ? view.error.message : String(view.error)}`
                : 'Loading two assemblies…'}
            </div>
          )}
        </div>
      </DisplayUIProvider>
    </PaletteProvider>
  )
})

export default SyntenyRibbons
