import { createContext } from 'react'

/**
 * #api
 * The one box per display that owns the bottom-right corner.
 *
 * It lives beside the overlay contract rather than with the chrome that mounts
 * it, because it is the half of that contract the types cannot carry:
 * `DisplayChromeOverlays.BackgroundProgress` is the one state told to render an
 * in-flow chip with no `position` and no corner offsets, and this is the box it
 * is laid out in. A host writing their own display over `DisplayChromeBase`
 * needs to be able to build that corner; while this sat one layer up in the LGV
 * plugin, the rule was a paragraph they could only obey by hand.
 *
 * Two independent things want that corner and neither could see the other:
 * the display's own control row (`BottomRightIndicators` — track sizing, the
 * isoform notice, the solo chip) and the chrome's background-progress chip
 * (`DisplayChromeOverlays.BackgroundProgress`, the status channel for work with
 * no fetch behind it). Both portal into the *same* per-track overlay node, and
 * both used to claim `bottom: 2; right: 2` there with their own
 * `position: absolute` box — so they simply drew on top of each other, the
 * controls winning on z-index and the status text disappearing under them.
 *
 * It has never been reachable: the two displays that render the control row
 * (alignments, canvas) are not among the four that report a `ready`-phase
 * status (clustering, on multi-wiggle / multi-row features / maf / the
 * multi-sample variant pair). That is the *reason* to make it structural rather
 * than to leave it — nothing on either side is aware of the constraint, so the
 * first display to want both would find the bug, and it presents as a status
 * message that silently never appears.
 *
 * `BottomRightIndicators` already described itself as "the single anchor point
 * for every bottom-right overlay ... so they lay out as one row instead of each
 * picking their own position and colliding". This makes that true of the chip
 * too: the chrome renders the anchor, puts its chip in it, and publishes the
 * node here so the display's row — rendered several components away, inside the
 * chrome's body — lands in the same flex box instead of over it.
 *
 * `null` outside a chrome (a display an embedder mounts standalone, a unit
 * test, the SVG export), where `BottomRightIndicators` keeps its own anchored
 * box. That fallback is why this can be added without every consumer changing.
 */
export const BottomRightCornerContext = createContext<HTMLElement | null>(null)

/**
 * Members are stacked, not laid side by side, and ordered explicitly.
 *
 * Stacked because the status chip is much wider than a control (it carries a
 * label and a 120px bar): in one horizontal row it would shove the controls
 * leftwards whenever a background job started and let them snap back when it
 * finished.
 *
 * Ordered by `order` rather than by DOM position because one member arrives as
 * a portal and the other as an ordinary child, and the relative order of those
 * two inside the container is not something React documents. Only the control
 * row needs a value: the status chip takes CSS's default 0, so anything the
 * chrome adds to the corner later sorts above the controls unless it says
 * otherwise — which is the right default, the controls being the thing whose
 * position in the corner users learn.
 */
export const BOTTOM_RIGHT_CONTROLS_ORDER = 1
