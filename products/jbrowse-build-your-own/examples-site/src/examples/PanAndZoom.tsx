import { useMemo, useState } from 'react'

import { observer } from 'mobx-react'

import { makeView, wiggleTrack } from '../browser/engine.ts'
import {
  TrackRow,
  ZoomHint,
  isViewReady,
  usePanZoom,
  useViewWidth,
} from '../browser/parts.tsx'

// Drag to pan, wheel to zoom, shift+wheel to scroll sideways.
//
// The view already clamps to the ends of the assembly and to its own zoom
// limits, and `zoomTo` keeps a chosen pixel anchored, so `usePanZoom` (in
// browser/parts.tsx) is only translating events into calls.
//
// Two things in it are worth reading there rather than guessing at:
//
// The wheel handler is bound with
// `addEventListener('wheel', fn, { passive: false })` and not through React's
// `onWheel` prop. React registers wheel listeners as passive, so a handler on
// the prop cannot `preventDefault`, and the gesture would drive the browser
// page as well as the view.
//
// And `scrollZoom` decides what a bare wheel means. On by default, because a
// browser that owns its area should zoom the way a map does. Turn it off with
// the toggle below and zooming needs ctrl (cmd on a Mac) while a plain wheel
// scrolls the page -- the right trade when the browser is one element in a long
// document. That mode is undiscoverable on its own, so it comes with the prompt
// maps use: wheel without ctrl and the view says what it wanted.
const PanAndZoom = observer(function PanAndZoom() {
  const view = useMemo(
    () =>
      makeView({
        tracks: [wiggleTrack],
        loc: 'ctgA:1..50,000',
        show: ['volvox_microarray'],
      }),
    [],
  )
  const [scrollZoom, setScrollZoom] = useState(true)
  const ref = useViewWidth(view)
  const { hint, props } = usePanZoom(view, ref, { scrollZoom })

  return (
    <div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.85rem',
          paddingBottom: 8,
        }}
      >
        <input
          type="checkbox"
          checked={scrollZoom}
          onChange={event => {
            setScrollZoom(event.target.checked)
          }}
        />
        Wheel zooms directly (uncheck to require ctrl, and see the prompt)
      </label>
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
        {isViewReady(view) ? (
          <TrackRow view={view} trackId="volvox_microarray" />
        ) : null}
      </div>
      <Position view={view} />
    </div>
  )
})

// Reading position straight off the view, to show it is a live observable and
// not something the chrome has to be told about.
const Position = observer(function Position({
  view,
}: {
  view: ReturnType<typeof makeView>
}) {
  // The gate is not optional politeness: `view.width` throws by design before
  // the view has been measured, and the block getters read it, so anything
  // reading position has to check first. See `isViewReady` for why the check is
  // not `view.initialized`.
  const block = isViewReady(view)
    ? view.dynamicBlocks.contentBlocks[0]
    : undefined
  return (
    <div style={{ fontSize: '0.8rem', opacity: 0.7, paddingTop: 4 }}>
      {block
        ? `${block.refName}:${Math.floor(block.start).toLocaleString()}-${Math.ceil(block.end).toLocaleString()}  ·  ${view.bpPerPx.toFixed(2)} bp/px`
        : 'loading'}
    </div>
  )
})

export default PanAndZoom
