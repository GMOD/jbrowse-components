import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { COMPARE_MODES } from './filters.ts'

import type { SpecEntry } from '../review-payload.ts'
import type { CompareMode } from './filters.ts'
import type { ReactNode, RefObject } from 'react'

// The two pictures, however the page is set to show them.
//
// Side by side answers "what changed" only for a change big enough to find
// twice; a figure whose row packing moved by a few pixels, or whose one bar
// recoloured, reads as identical in two columns 700px apart. Stacked, the eye is
// looking at one picture and the difference is the thing that moves. Three ways
// of doing that share one stage: fade (onion), a draggable divider (swipe), and
// difference blending (diff) — they differ only in what the CSS does with
// `.cmptop`, so the markup, the sizing and the size-mismatch warning are written
// once.

// half and half, the position at which both pictures are equally present and
// neither is the one being checked against the other
const COMPARE_DEFAULT = 50

// A cap on height, not on width, and never a scale above 1: the point is to put
// the two images in the same place at the same size, and an upscaled figure is
// two interpolations hiding the small differences the overlay exists to show.
const CMP_MAX_PX = 600

interface Dim {
  w: number
  h: number
}

const dimText = (d: Dim) => `${d.w}×${d.h}`

const toDim = (wh: [number, number] | undefined): Dim | undefined =>
  wh ? { w: wh[0], h: wh[1] } : undefined

// The hash rides in the URL so the browser refetches exactly when the pixels
// change and caches otherwise. Without it a regen leaves the reviewer looking at
// a cached image while judging the one now on disk.
export const currentSrc = (spec: SpecEntry) =>
  `/img/${spec.name}.png?v=${spec.imageHash ?? ''}`

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

// How the pair is being looked at is one setting for the whole page, not one per
// card. A reviewer working down 150 figures is asking the same question of each
// of them, so the mode reached for on the card in front of you is the mode the
// next one wants too — per-card state meant switching to onion 150 times, and it
// meant the header's Compare control could only be believed by throwing away
// every card that had been switched by hand.
//
// It reaches the cards as context rather than as props on Card, so a change here
// redraws the compare half of each card and not the pills, note box and verdict
// buttons below it — those are memoized past it.
export interface CompareView {
  mode: CompareMode
  amp: boolean
  blink: boolean
  fade: FadeStore
  onMode: (m: CompareMode) => void
  onAmp: (v: boolean) => void
  onBlink: (v: boolean) => void
}

const CompareViewContext = createContext<CompareView | undefined>(undefined)

function useCompareView() {
  const view = use(CompareViewContext)
  if (!view) {
    throw new Error('a Compare card was drawn outside CompareViewProvider')
  }
  return view
}

// The fade — the onion's opacity, the swipe's divider — is the one of these that
// moves with the pointer down, sixty times a second, and it is now the page's
// rather than one card's. Through React that is every card redrawn per frame,
// and on the 349-card All tab it measured 122ms a frame passed as a prop and
// 80ms as a context value (a changed context walks the tree looking for
// consumers whether or not any of them re-render), against 31ms for writing the
// two custom properties onto the stages and nothing else. So this value alone is
// kept out of the render: what wants it registers a write, and `set` calls them.
//
// Writing it once on an ancestor and letting the stages inherit is the obvious
// alternative and is worse — 65ms, because a custom property on a wrapper
// invalidates style for the whole subtree under it rather than for 349 stages.
//
// Everything else here is a click, and stays ordinary React.
export interface FadeStore {
  get: () => number
  set: (v: number) => void
  subscribe: (el: Element, apply: (v: number) => void) => () => void
}

// Off screen is not written. A drag over the All tab is three or four elements a
// reviewer can see and ~1400 they cannot, and the ones they cannot are the
// expensive ones: writing every slider position and readout as well as every
// stage measured 98ms a frame against 34ms for the stages alone, because text
// and form values dirty layout where a custom property only dirties style. Each
// registration is caught up the moment it comes into view, and `rootMargin`
// makes that a screenful early rather than at the edge, so a stage cannot paint
// once at the old fade on the way in.
function createFadeStore(): FadeStore {
  let value = COMPARE_DEFAULT
  const subs = new Map<
    Element,
    { apply: (v: number) => void; shown: boolean }
  >()
  const io = new IntersectionObserver(
    entries => {
      for (const e of entries) {
        const sub = subs.get(e.target)
        if (sub) {
          sub.shown = e.isIntersecting
          if (e.isIntersecting) {
            sub.apply(value)
          }
        }
      }
    },
    { rootMargin: '800px 0px' },
  )
  return {
    get: () => value,
    set: v => {
      if (v !== value) {
        value = v
        for (const sub of subs.values()) {
          if (sub.shown) {
            sub.apply(v)
          }
        }
      }
    },
    subscribe: (el, apply) => {
      subs.set(el, { apply, shown: true })
      apply(value)
      io.observe(el)
      return () => {
        io.unobserve(el)
        subs.delete(el)
      }
    },
  }
}

// `apply` has to be stable — both callers write through a ref and so have
// nothing to close over. A layout effect, and `subscribe` applies once on
// registering, so a stage or slider that has just been mounted — a mode change,
// or a card the reviewer has scrolled to — is drawn at the page's fade rather
// than at the default for a frame.
function useFade(
  ref: RefObject<Element | null>,
  apply: (v: number) => void,
): void {
  const { fade } = useCompareView()
  useLayoutEffect(() => {
    const el = ref.current
    return el ? fade.subscribe(el, apply) : undefined
  }, [fade, ref, apply])
}

// The mode comes from above, because it is a filter and lives in the URL with
// the rest of them. The other three are momentary aids rather than ways of
// looking — you turn one on for the four seconds it takes to answer a question —
// so they are held here and are not worth a URL parameter.
//
// `children` is built by the caller, so a change here re-renders this component,
// the wrapper's class and whichever cards read the context — never the cards
// themselves, which are the same element objects React already has.
export function CompareViewProvider({
  mode,
  onMode,
  children,
}: {
  mode: CompareMode
  onMode: (m: CompareMode) => void
  children: ReactNode
}) {
  const [fade] = useState(createFadeStore)
  const [amp, setAmp] = useState(false)
  const [blink, setBlink] = useState(false)
  const view = useMemo(
    () => ({
      mode,
      amp,
      blink,
      fade,
      onMode,
      onAmp: setAmp,
      onBlink: setBlink,
    }),
    [mode, amp, blink, fade, onMode],
  )
  return (
    <CompareViewContext value={view}>
      {/* Amplify and blink are classes on the wrapper rather than props on the
          stage: both are the page's, and one class toggle turns every stage on
          without redrawing a card. The fade cannot ride up here with them, for
          the reason above — a click can afford the subtree-wide style
          invalidation an inherited property costs, and a drag cannot. */}
      <div
        className={`cards${amp ? ' cmpamp' : ''}${blink ? ' cmpblink' : ''}`}
      >
        {children}
      </div>
    </CompareViewContext>
  )
}

export function Compare({ spec }: { spec: SpecEntry }) {
  const { mode: wanted, amp, blink, onMode, onAmp, onBlink } = useCompareView()
  // A stacked comparison is only offered where there are two pictures to stack:
  // a figure added on this branch has no baseline, and one that is not on disk
  // has nothing to draw. The side-by-side column already says which of those it
  // is, so those cards get no bar and no choice.
  //
  // Only this card, though: it is not a vote on what the rest of the page shows,
  // so the page-wide mode is left alone and this one falls back to side.
  const canCompare = spec.exists && !!spec.mainUrl
  const mode = canCompare ? wanted : 'side'
  // The natural sizes of whichever images have arrived. Held here rather than in
  // the stage so the size-mismatch warning, which is drawn up in the bar, is
  // derived rather than pushed.
  //
  // Seeded from the payload, which got both sizes out of the two manifests for
  // nothing, so the stage has its box before either image loads rather than
  // growing into it as they arrive. `onLoad` still overwrites with what actually
  // decoded — the manifest can be wrong about a figure regenerated since the
  // page was served, and the picture is the authority.
  const [dims, setDims] = useState<{ base?: Dim; top?: Dim }>(() => ({
    base: toDim(spec.mainSize),
    top: toDim(spec.size),
  }))
  const [noBaseline, setNoBaseline] = useState(false)

  const onDim = useCallback((which: 'base' | 'top', d: Dim) => {
    setDims(prev => ({ ...prev, [which]: d }))
  }, [])

  // A resize is the one change a pixel diff cannot see (pngDiffFraction returns
  // null on a size mismatch), and it is also the one the overlay itself is worst
  // at showing — everything below the change looks shifted. Say it.
  const note = noBaseline
    ? '⚠ baseline bytes are not in the store — only the current image is here'
    : dims.base && dims.top && dimText(dims.base) !== dimText(dims.top)
      ? `resized ${dimText(dims.base)} → ${dimText(dims.top)} — drawn at one ` +
        'scale from the top-left, so the extra edge is the change in size'
      : ''

  return (
    <>
      {canCompare ? (
        <CompareBar
          spec={spec}
          mode={mode}
          onMode={onMode}
          amp={amp}
          onAmp={onAmp}
          blink={blink}
          onBlink={onBlink}
          note={note}
        />
      ) : null}
      {mode === 'side' ? (
        <SideBySide spec={spec} />
      ) : (
        <Stage
          spec={spec}
          mode={mode}
          dims={dims}
          onDim={onDim}
          noBaseline={noBaseline}
          onBaselineFailed={() => {
            setNoBaseline(true)
          }}
        />
      )}
    </>
  )
}

function CmpBtn({
  on,
  label,
  title,
  onClick,
}: {
  on: boolean
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={on ? 'cmpbtn on' : 'cmpbtn'}
      title={title}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

// The keyboard-reachable half of the fade, and — in swipe — of the divider the
// stage itself is dragged by. Uncontrolled, and the readout beside it is written
// rather than rendered, because the value driving both is the page's and belongs
// to no card's render: see FadeStore. `defaultValue` is only ever the value the
// store starts at; the effect owns it from mount onwards, and runs before the
// first paint, so a slider mounted later still comes up in the right place.
function FadeSlider({ label }: { label: string }) {
  const { fade } = useCompareView()
  const inputRef = useRef<HTMLInputElement>(null)
  const pctRef = useRef<HTMLSpanElement>(null)
  useFade(
    inputRef,
    useCallback((v: number) => {
      if (inputRef.current) {
        inputRef.current.value = String(v)
      }
      if (pctRef.current) {
        pctRef.current.textContent = `${v}%`
      }
    }, []),
  )
  return (
    <>
      <input
        className="cmpslider"
        type="range"
        min="0"
        max="100"
        step="1"
        ref={inputRef}
        defaultValue={COMPARE_DEFAULT}
        aria-label={label}
        onChange={e => {
          fade.set(Number(e.target.value))
        }}
      />
      <span className="cmppct" ref={pctRef} />
    </>
  )
}

// One bar per card, in every mode, so the way you are looking at a pair is
// always switchable from where you are looking. Every control on it sets the
// page, though — the bar is drawn on each card because that is where the hand
// is, not because the setting belongs to the card.
function CompareBar({
  spec,
  mode,
  onMode,
  amp,
  onAmp,
  blink,
  onBlink,
  note,
}: {
  spec: SpecEntry
  mode: CompareMode
  onMode: (m: CompareMode) => void
  amp: boolean
  onAmp: (v: boolean) => void
  blink: boolean
  onBlink: (v: boolean) => void
  note: string
}) {
  return (
    <div className="cmpbar">
      {/* the four ways of looking are one segmented control, not four loose
          buttons: they are alternatives, and only one is ever on */}
      <span className="cmpmodes">
        {COMPARE_MODES.map(([id, label, title]) => (
          <CmpBtn
            key={id}
            on={id === mode}
            label={label}
            title={title}
            onClick={() => {
              onMode(id)
            }}
          />
        ))}
      </span>
      {/* Nothing to steer in side mode, and no "open full size" link either:
          each column already opens its own picture on click. */}
      {mode === 'side' ? null : mode === 'onion' ? (
        <>
          {/* The ends are labelled with the two things being faded between
              rather than with a number, because 0% and 100% do not say which
              picture is which — and getting that backwards turns "the new one
              lost a track" into "the new one gained a track". */}
          <span>origin/main</span>
          <FadeSlider label="Fade between origin/main and the current branch" />
          <span>current branch</span>
          <CmpBtn
            on={blink}
            label="⚡ blink"
            title="Cut between the two twice a second — whatever moves is the change"
            onClick={() => {
              onBlink(!blink)
            }}
          />
        </>
      ) : mode === 'swipe' ? (
        // No end labels on this one: the divider answers which is which
        // spatially, the stage says so in its corners, and a second answer on
        // the slider would contradict them everywhere except the ends.
        <>
          <span>divider</span>
          <FadeSlider label="Move the divider between origin/main and the current branch" />
        </>
      ) : (
        <>
          <span className="cmphint">black = identical</span>
          <CmpBtn
            on={amp}
            label="⊕ amplify"
            title="Multiply the difference 8× — a one-shade recolour is otherwise indistinguishable from black"
            onClick={() => {
              onAmp(!amp)
            }}
          />
        </>
      )}
      {/* the way back to the full-size pictures: the stage modes lose the
          click-to-open each side-by-side column has, and full size is the
          fallback for an overlay that says "something moved here" without
          saying what */}
      {mode === 'side' ? null : (
        <span className="cmplink">
          open{' '}
          <a href={currentSrc(spec)} target="_blank" rel="noopener">
            current ↗
          </a>{' '}
          ·{' '}
          <a href={spec.mainUrl} target="_blank" rel="noopener">
            main ↗
          </a>
        </span>
      )}
      <span className="cmpnote">{note}</span>
    </div>
  )
}

function ImgCol({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="imgcol">
      <div className="imglabel">
        <span>{label}</span>
      </div>
      <div className="imgwrap">{children}</div>
    </div>
  )
}

function SideBySide({ spec }: { spec: SpecEntry }) {
  // Straight at the store. The baseline URL is the figure's content hash, so it
  // is immutable, public and cached for a year by CloudFront — nothing for this
  // server to proxy, and the link keeps resolving from any commit's manifest.
  const [mainFailed, setMainFailed] = useState(false)
  // width/height ATTRIBUTES, not styles: they give the browser the aspect ratio
  // to reserve the box with while the bytes are in flight, and the CSS
  // (max-width/max-height, height auto) still decides the drawn size. Without
  // them a column is its 180px floor until the picture decodes and up to 400px
  // after, so scrolling the list is a procession of cards growing under the
  // pointer. 58% of the corpus draws shorter than the 400px cap, so reserving a
  // flat box instead would letterbox most of it.
  //
  // `--ratio` is the same two numbers again, in the form the height cap needs to
  // become a width cap. The attributes make the width definite, and a definite
  // width is not something `max-height` can shrink — the CSS says why.
  const size = (wh: [number, number] | undefined) =>
    wh
      ? {
          width: wh[0],
          height: wh[1],
          style: { '--ratio': wh[0] / wh[1] } as React.CSSProperties,
        }
      : {}
  return (
    <div className="card-images">
      <ImgCol label="current branch">
        {spec.exists ? (
          <img
            src={currentSrc(spec)}
            alt={spec.name}
            {...size(spec.size)}
            onClick={e => {
              window.open(e.currentTarget.src)
            }}
          />
        ) : spec.unpulled ? (
          // Two different holes with two different fixes. figures.lock naming a
          // figure this checkout has not fetched is the ordinary one — the bytes
          // are in the store and a regen would be wasted work.
          <div className="missing">
            ⚠ not on this machine — <code>pnpm figures:pull</code>
          </div>
        ) : (
          <div className="missing">
            ⚠ no image and nothing in the store — regenerate it
          </div>
        )}
      </ImgCol>
      <ImgCol label="origin/main">
        {!spec.mainUrl ? (
          <div className="missing notonmain">not on origin/main</div>
        ) : mainFailed ? (
          <div className="missing">⚠ baseline bytes are not in the store</div>
        ) : (
          <img
            src={spec.mainUrl}
            alt={`${spec.name} on origin/main`}
            loading="lazy"
            {...size(spec.mainSize)}
            onClick={e => {
              window.open(e.currentTarget.src)
            }}
            onError={() => {
              setMainFailed(true)
            }}
          />
        )}
      </ImgCol>
    </div>
  )
}

function Stage({
  spec,
  mode,
  dims,
  onDim,
  noBaseline,
  onBaselineFailed,
}: {
  spec: SpecEntry
  mode: Exclude<CompareMode, 'side'>
  dims: { base?: Dim; top?: Dim }
  onDim: (which: 'base' | 'top', d: Dim) => void
  noBaseline: boolean
  onBaselineFailed: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [wrapW, setWrapW] = useState(0)
  const { fade } = useCompareView()

  // Both `--fade` and `--wipe` are written in every mode, and each mode's CSS
  // reads the one it cares about. A mode-dependent write would leave the other
  // property behind at whatever it was when the mode last changed, which shows
  // up the moment you switch modes mid-review.
  useFade(
    stageRef,
    useCallback((v: number) => {
      const el = stageRef.current
      if (el) {
        el.style.setProperty('--fade', String(v / 100))
        el.style.setProperty('--wipe', `${v}%`)
      }
    }, []),
  )

  // The stage is sized in px off natural dimensions, so a narrowed window would
  // otherwise leave it overflowing the card. An observer on the wrap rather than
  // a window listener, so it also catches a layout change that moves the column
  // without moving the window.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) {
      return
    }
    const ro = new ResizeObserver(entries => {
      setWrapW(entries[0]?.contentRect.width ?? 0)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [])

  // Lay the stage out off whatever has arrived, rather than waiting for both.
  // The images are absolutely positioned, so an unsized stage is a 0px-tall
  // stage: waiting left every card below the fold collapsed to its min-height,
  // and the baseline half is deliberately lazy — on a 184-card view that is 178
  // stages that only get a height once you scroll to them, each shoving the page
  // as it arrives. The current image is local and eager, so it lands first and
  // sizes the stage; the baseline refits it on arrival, which moves nothing
  // unless it is a different size, and that case is said out loud in the bar.
  const present = [dims.base, dims.top].filter(d => !!d)
  const nat = present.length
    ? {
        w: Math.max(...present.map(d => d.w)),
        h: Math.max(...present.map(d => d.h)),
      }
    : undefined
  const scale = nat
    ? Math.min(1, (wrapW || nat.w) / nat.w, CMP_MAX_PX / nat.h)
    : 1
  // the stage holds the box; the images are absolutely positioned inside it, so
  // it is the only thing giving the card its height
  const box = nat
    ? { width: Math.round(nat.w * scale), height: Math.round(nat.h * scale) }
    : undefined
  const imgStyle = (d: Dim | undefined) =>
    d
      ? { width: Math.round(d.w * scale), height: Math.round(d.h * scale) }
      : undefined

  const dragging = useRef(false)
  const moveTo = (el: HTMLDivElement, clientX: number) => {
    const rect = el.getBoundingClientRect()
    fade.set(clamp(((clientX - rect.left) / rect.width) * 100))
  }

  // Dragging on the picture itself is what a swipe comparison IS — the pointer
  // lands on the thing being compared, so the divider goes where you are already
  // looking rather than where a control 200px above it says. The slider in the
  // bar is the keyboard-reachable half of the same value.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'swipe') {
      return
    }
    // Capture, because the useful end of a wipe is at the edges and most drags
    // leave the stage before they get there. Without it the divider stops dead
    // partway and the reviewer has to re-grab it. It is also what keeps the
    // subsequent moves targeted at this element.
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    moveTo(e.currentTarget, e.clientX)
  }

  const onLoad =
    (which: 'base' | 'top') => (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget
      if (w && h) {
        onDim(which, { w, h })
      }
    }

  return (
    <div className="cmpwrap" ref={wrapRef}>
      {/* React renders the mode and the box, and nothing else: the box is the
          only one of a stage's inputs that is this card's own, and it is what
          gives the card its height. Amplify and blink arrive as a class on the
          wrapper above, the fade as two custom properties the effect writes. */}
      <div
        className={`cmpstage ${mode}`}
        style={box}
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={e => {
          if (dragging.current) {
            moveTo(e.currentTarget, e.clientX)
          }
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onPointerCancel={() => {
          dragging.current = false
        }}
      >
        {/* The store URL 404s when a baseline's bytes were never pushed. Drop it
            and show the current image alone rather than fading to black, which
            reads as the figure having gone blank on this branch. */}
        {noBaseline ? null : (
          <img
            className="cmpbase"
            src={spec.mainUrl}
            alt=""
            loading="lazy"
            draggable={false}
            style={imgStyle(dims.base)}
            onLoad={onLoad('base')}
            onError={onBaselineFailed}
          />
        )}
        <img
          className="cmptop"
          src={currentSrc(spec)}
          alt=""
          draggable={false}
          style={imgStyle(dims.top)}
          onLoad={onLoad('top')}
        />
        {mode === 'swipe' ? (
          <>
            {/* Each label is capped at the width of the side it names, so a
                divider taken to an edge takes its label with it — a label that
                kept naming a region no longer on screen is the one thing these
                labels exist to prevent getting backwards. */}
            <div className="cmpside left">
              <span>origin/main</span>
            </div>
            <div className="cmpside right">
              <span>current branch</span>
            </div>
            <div className="cmphandle" />
          </>
        ) : null}
      </div>
    </div>
  )
}
