import { Suspense, useEffect, useRef, useState } from 'react'

import { setConf } from '@jbrowse/core/configuration'
import { PaletteProvider, usePalette } from '@jbrowse/core/ui/PaletteContext'
import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import {
  DisplayChromeOverlayProvider,
  TrackControlProvider,
  plainChromeOverlays,
  plainTrackControl,
} from '@jbrowse/plugin-linear-genome-view'
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
  uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit',
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
  })
  const { view } = state.session
  view.setInit({
    assembly: hg38.name,
    // A locstring takes as many regions as you give it, and `init.loc` hands
    // whatever you write here straight to `navToLocString`. `init` also accepts
    // `displayedRegionNames: CHROMOSOMES` for the same result without the join.
    loc: CHROMOSOMES.join(' '),
    tracks: ['hg38_phylop'],
  })
  // see the Pan and zoom page: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']
type BrowserSession = ReturnType<typeof makeView>['session']

function useViewWidth(view: BrowserView) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w > 0) {
        view.setWidth(w)
      }
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [view])
  return ref
}

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

// see the Pan and zoom page for why the wheel listener is native and
// non-passive, for what `scrollZoom` decides, and for why shift+wheel is left
// to whatever is under the cursor
function wheelPanZoom(
  view: BrowserView,
  el: HTMLElement,
  { scrollZoom, onNeedsCtrl }: { scrollZoom: boolean; onNeedsCtrl: () => void },
) {
  return (event: WheelEvent) => {
    if (event.shiftKey && scrollZoom) {
      return
    }
    const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
    const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
    const ctrlZoom = event.ctrlKey || event.metaKey
    if (ctrlZoom || (scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX))) {
      event.preventDefault()
      if (deltaY !== 0) {
        const rect = el.getBoundingClientRect()
        view.zoomTo(
          view.bpPerPx * (deltaY > 0 ? 1.1 : 1 / 1.1),
          event.clientX - rect.left,
        )
      }
    } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault()
      view.horizontalScroll(deltaX)
    } else if (deltaY !== 0) {
      onNeedsCtrl()
    }
  }
}

const HINT_LINGER_MS = 1200

// how far a press has to travel before it counts as a pan rather than a click;
// see the Pan and zoom page
const DRAG_THRESHOLD_PX = 4

function usePanZoom(
  view: BrowserView,
  ref: React.RefObject<HTMLDivElement | null>,
) {
  const draggingRef = useRef<{ x: number; panning: boolean } | undefined>(
    undefined,
  )
  const [hint, setHint] = useState(false)
  const { scrollZoom } = view

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const onWheel = wheelPanZoom(view, el, {
      scrollZoom,
      onNeedsCtrl() {
        setHint(true)
        clearTimeout(timer)
        timer = setTimeout(() => {
          setHint(false)
        }, HINT_LINGER_MS)
      },
    })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(timer)
    }
  }, [view, ref, scrollZoom])

  return {
    hint,
    props: {
      onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        // see the Pan and zoom page for both halves of this: why a press on a
        // control must not start a pan, and why the pointer is captured on move
        // rather than here
        if (
          event.target instanceof Element &&
          event.target.closest('button, [data-gesture-owner]')
        ) {
          return
        }
        if (event.button === 0) {
          draggingRef.current = { x: event.clientX, panning: false }
        }
      },
      onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const drag = draggingRef.current
        if (!drag) {
          return
        }
        if (!drag.panning) {
          if (Math.abs(event.clientX - drag.x) < DRAG_THRESHOLD_PX) {
            return
          }
          drag.panning = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        view.horizontalScroll(drag.x - event.clientX)
        drag.x = event.clientX
      },
      onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
        draggingRef.current = undefined
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      },
      onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
        draggingRef.current = undefined
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      },
    },
  }
}

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

/**
 * The name on each region. See the Scalebar page, which explains the sticky
 * behaviour: the label of the region you are inside stays pinned to the left
 * edge while you pan past its start, instead of scrolling away with it.
 */
const RegionNames = observer(function RegionNames({
  view,
}: {
  view: BrowserView
}) {
  const { staticBlocks, scalebarRegionEndPx, offsetPx } = view
  const palette = usePalette()
  const blocks = staticBlocks.contentBlocks
  const stickyIndex = Math.max(
    blocks.findLastIndex(block => block.offsetPx < offsetPx),
    0,
  )
  return blocks.map((block, i) => {
    if (i !== stickyIndex && !block.isLeftEndOfDisplayedRegion) {
      return null
    }
    // a content block always has an index, though the block type leaves it
    // optional; -1 simply misses the map
    const regionEndPx = scalebarRegionEndPx.get(
      block.displayedRegionIndex ?? -1,
    )
    const left = Math.max(block.offsetPx - offsetPx, 0)
    const maxWidth = (regionEndPx ?? 0) - offsetPx - left
    return maxWidth > 0 ? (
      <span
        key={block.key}
        style={{
          position: 'absolute',
          top: 0,
          left,
          maxWidth,
          padding: '0 3px',
          background: palette.background.paper,
          color: palette.text.primary,
          fontWeight: 'bold',
          // ellipsis, not a bare clip: clipped to its own width, `chr16` reads
          // as `chr1`, which is a different chromosome rather than a shortened
          // name. 8 of these 24 are too narrow for their label.
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {block.refName}
      </span>
    ) : null
  })
})

/**
 * The line between two displayed regions, which you have to draw. See the Drive
 * it from your app page for why it is opaque, why the last region's right end
 * is skipped, and where the geometry comes from.
 */
const RegionBoundaries = observer(function RegionBoundaries({
  view,
}: {
  view: BrowserView
}) {
  const { staticBlocks, offsetPx, displayedRegions } = view
  const lastRegionIndex = displayedRegions.length - 1
  return staticBlocks.blocks
    .filter(
      block =>
        block.isRightEndOfDisplayedRegion &&
        block.displayedRegionIndex !== lastRegionIndex,
    )
    .map(block => (
      <div
        key={block.key}
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: block.offsetPx + block.widthPx - offsetPx - 1,
          width: 3,
          zIndex: 2,
          pointerEvents: 'none',
          background: 'color-mix(in srgb, CanvasText 45%, Canvas)',
        }}
      />
    ))
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
 * back off the session. See the Bring your own overlays page for why this is
 * one write rather than two.
 */
function useSitePalette(session: BrowserSession) {
  const mode = useSiteMode()
  useEffect(() => {
    setConf(session, 'theme', { palette: { mode } })
  }, [session, mode])
  return session.palette
}

const EveryChromosome = observer(function EveryChromosome() {
  const [{ view, session }] = useState(makeView)
  const ref = useViewWidth(view)
  const { hint, props } = usePanZoom(view, ref)
  const palette = useSitePalette(session)

  return (
    <PaletteProvider palette={palette}>
      <DisplayChromeOverlayProvider value={plainChromeOverlays}>
        <TrackControlProvider value={plainTrackControl}>
          <div
            ref={ref}
            {...props}
            style={{
              position: 'relative',
              overflow: 'hidden',
              touchAction: 'none',
              cursor: 'grab',
            }}
          >
            <ZoomHint show={hint} />
            {/* both overlays read block geometry, which throws until the
             * ResizeObserver has reported a width -- see the Drive it from
             * your app page */}
            {isViewReady(view) ? (
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
            ) : null}
          </div>
        </TrackControlProvider>
      </DisplayChromeOverlayProvider>
    </PaletteProvider>
  )
})

export default EveryChromosome
