import { createContext } from 'react'

/**
 * The one box per display that owns the bottom-right corner.
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
 * finished. Ordered by `order` rather than by DOM position because one member
 * arrives as a portal and the other as an ordinary child, and the relative
 * order of those two in the container is not something React documents.
 */
export const BOTTOM_RIGHT_STATUS_ORDER = 0
export const BOTTOM_RIGHT_CONTROLS_ORDER = 1
