import { useState } from 'react'

import { TrackOverlayContext } from './TrackOverlayContext.ts'

/**
 * #api
 * The box a display is mounted in, plus the overlay node its floating chrome
 * escapes into. Pair to `TrackOverlayPortal`, which is the other end.
 *
 * A display's React tree is sealed in a `contain: strict` sandbox — that is what
 * isolates its paint, and dropping it is measured and rejected (ADR-058). A
 * stacking context comes with the isolation, so floating chrome a display draws
 * (a colour key, hi-c's overlay panel, maf's row labels) cannot out-z-index
 * anything painted over the track stack from outside. The escape is a node
 * mounted *beside* the sandbox rather than inside it, published through
 * `TrackOverlayContext`; this component is that node, its context and the paint
 * order between them, in the one place they have to agree.
 *
 * `TrackContainer` uses it, so JBrowse's own layout and an embedder's go through
 * the same code rather than two copies of one rule. **An embedder mounting
 * `RenderingComponent` directly needs it too**, and that is the case it was
 * added for: with no provider the context is null, the portal falls back to
 * rendering inline, and a host that paints region seams over its column buries
 * the chrome under them with nothing to say so.
 *
 * ```tsx
 * <TrackOverlaySlot zIndex={3} style={{ height: display.height }}>
 *   <div style={{ position: 'absolute', inset: 0, contain: 'strict' }}>
 *     <RenderingComponent model={display} />
 *   </div>
 * </TrackOverlaySlot>
 * ```
 *
 * **`zIndex` is required, and deliberately has no default.** It is the answer to
 * "above what?", and that is a fact about the caller's layout rather than about
 * this component: JBrowse's own track container passes 100, which is positioned
 * above `PaddingBlocks` and below `TrackLabel` at 200, and means nothing to a
 * host whose masks sit at 2. A default would be a number that is right in one
 * layout and silently wrong in every other, and the failure — chrome painted
 * under a mask — is invisible until someone looks at the right zoom.
 *
 * The node takes no pointer events, so it does not eat the canvas's. Chrome that
 * wants them takes them back on its own positioned box; it also carries
 * `data-gesture-owner`, so anything that does is already exempt from the LGV's
 * click-drag pan.
 */
export function TrackOverlaySlot({
  children,
  zIndex,
  style,
  overlayStyle,
}: {
  children: React.ReactNode
  /** Paint order for the overlay node, against whatever the caller draws over
   * the track stack. No default on purpose — see above. */
  zIndex: number
  /** The box the display is mounted in. Its height, usually. */
  style?: React.CSSProperties
  /** Placement escape for the overlay node. `TrackContainer` passes a negative
   * `left` to cancel its Paper border, so the node covers the canvas
   * edge-to-edge rather than leaving a sliver. */
  overlayStyle?: React.CSSProperties
}) {
  // element state rather than a ref, so consumers re-render once the portal
  // target mounts and the context value flips from null to the node
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null)
  return (
    // `data-track-overlay-slot` is how a test says "this display is in a slot"
    // in one selector, against `data-display-id` on the display root. Forgetting
    // the slot is invisible on a page at rest — the portal falls back to
    // rendering inline and the chrome only disappears once something is painted
    // over it — so the mechanism has to be checkable rather than the symptom.
    // A plain marker rather than a `data-testid`, like `data-display-id`: it is
    // a structural fact about the layout, not a hook for one suite.
    <div
      data-track-overlay-slot="true"
      style={{ position: 'relative', ...style }}
    >
      <TrackOverlayContext value={overlayEl}>{children}</TrackOverlayContext>
      {/* outside the display's sandbox, and after it in paint order */}
      <div
        ref={setOverlayEl}
        data-gesture-owner="true"
        // the escape hatch itself, so a test can ask "did this chrome land in
        // the overlay node" with one `closest()` rather than walking the tree
        // looking for a `contain: strict` it hopes is the sandbox
        data-track-overlay-node="true"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '100%',
          pointerEvents: 'none',
          zIndex,
          ...overlayStyle,
        }}
      />
    </div>
  )
}
