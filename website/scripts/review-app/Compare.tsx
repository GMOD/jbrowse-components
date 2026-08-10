import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { COMPARE_MODES } from './filters.ts'

import type { SpecEntry } from '../review-payload.ts'
import type { CompareMode } from './filters.ts'

// The two pictures, however this card is set to show them.
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

// The hash rides in the URL so the browser refetches exactly when the pixels
// change and caches otherwise. Without it a regen leaves the reviewer looking at
// a cached image while judging the one now on disk.
export const currentSrc = (spec: SpecEntry) =>
  `/img/${spec.name}.png?v=${spec.imageHash ?? ''}`

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

export function Compare({
  spec,
  mode: wanted,
  onMode,
}: {
  spec: SpecEntry
  mode: CompareMode
  onMode: (mode: CompareMode) => void
}) {
  // A stacked comparison is only offered where there are two pictures to stack:
  // a figure added on this branch has no baseline, and one that is not on disk
  // has nothing to draw. The side-by-side column already says which of those it
  // is, so those cards get no bar and no choice.
  const canCompare = spec.exists && !!spec.mainUrl
  const mode = canCompare ? wanted : 'side'
  const [value, setValue] = useState(COMPARE_DEFAULT)
  // Amplify (diff) and blink (onion) are momentary aids rather than ways of
  // looking — you turn one on for the four seconds it takes to answer a
  // question — so neither is a mode, and neither goes in the URL.
  const [amp, setAmp] = useState(false)
  const [blink, setBlink] = useState(false)
  // The natural sizes of whichever images have arrived. Held here rather than in
  // the stage so the size-mismatch warning, which is drawn up in the bar, is
  // derived rather than pushed.
  const [dims, setDims] = useState<{ base?: Dim; top?: Dim }>({})
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
          value={value}
          onValue={setValue}
          amp={amp}
          onAmp={setAmp}
          blink={blink}
          onBlink={setBlink}
          note={note}
        />
      ) : null}
      {mode === 'side' ? (
        <SideBySide spec={spec} />
      ) : (
        <Stage
          spec={spec}
          mode={mode}
          value={value}
          onValue={setValue}
          amp={amp}
          blink={blink}
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

// One bar per card, in every mode, so the way you are looking at a pair is
// always switchable from the same place.
function CompareBar({
  spec,
  mode,
  onMode,
  value,
  onValue,
  amp,
  onAmp,
  blink,
  onBlink,
  note,
}: {
  spec: SpecEntry
  mode: CompareMode
  onMode: (m: CompareMode) => void
  value: number
  onValue: (v: number) => void
  amp: boolean
  onAmp: (v: boolean) => void
  blink: boolean
  onBlink: (v: boolean) => void
  note: string
}) {
  const slider = (label: string) => (
    <>
      <input
        className="cmpslider"
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        aria-label={label}
        onChange={e => {
          onValue(Number(e.target.value))
        }}
      />
      <span className="cmppct">{value}%</span>
    </>
  )
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
          {slider('Fade between origin/main and the current branch')}
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
          {slider(
            'Move the divider between origin/main and the current branch',
          )}
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
  return (
    <div className="card-images">
      <ImgCol label="current branch">
        {spec.exists ? (
          <img
            src={currentSrc(spec)}
            alt={spec.name}
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
  value,
  onValue,
  amp,
  blink,
  dims,
  onDim,
  noBaseline,
  onBaselineFailed,
}: {
  spec: SpecEntry
  mode: Exclude<CompareMode, 'side'>
  value: number
  onValue: (v: number) => void
  amp: boolean
  blink: boolean
  dims: { base?: Dim; top?: Dim }
  onDim: (which: 'base' | 'top', d: Dim) => void
  noBaseline: boolean
  onBaselineFailed: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [wrapW, setWrapW] = useState(0)

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
    onValue(clamp(((clientX - rect.left) / rect.width) * 100))
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

  const classes = ['cmpstage', mode]
  if (mode === 'diff' && amp) {
    classes.push('amp')
  }
  if (mode === 'onion' && blink) {
    classes.push('blink')
  }

  return (
    <div className="cmpwrap" ref={wrapRef}>
      <div
        className={classes.join(' ')}
        // Both `--fade` and `--wipe` are written in every mode, and each mode's
        // CSS reads the one it cares about. A mode-dependent write would leave
        // the other property behind at whatever it was when the mode last
        // changed, which shows up the moment you switch modes mid-review.
        style={
          {
            '--fade': value / 100,
            '--wipe': `${value}%`,
            ...box,
          } as React.CSSProperties
        }
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
