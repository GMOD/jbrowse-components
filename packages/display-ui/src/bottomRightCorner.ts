import { createContext } from 'react'

/**
 * #api
 * The one box per display that owns the bottom-right corner.
 *
 * Two members share it: the display's own control row
 * (`BottomRightIndicators`) and the chrome's background-progress chip
 * (`DisplayChromeOverlays.BackgroundProgress`). Both portal into the same
 * per-track overlay node, so each claiming the corner with its own
 * `position: absolute` box draws one over the other. The chrome renders this
 * box, lays its chip out in it, and publishes the node here so the control row,
 * rendered inside the chrome's body, lands in the same flex column.
 *
 * - A host writing their own display over `DisplayChromeBase` builds the corner
 *   from this; the chip is told to render in-flow, with no `position` and no
 *   corner offsets.
 * - `null` outside a chrome (a standalone mount, a unit test, the SVG export),
 *   where `BottomRightIndicators` anchors its own box.
 */
export const BottomRightCornerContext = createContext<HTMLElement | null>(null)

/**
 * The control row's flex `order` in the corner column. The members stack
 * rather than sit side by side, so a wide status chip starting or finishing
 * never shoves the controls sideways. `order` sets the sequence because one
 * member arrives as a portal and the other as a child, and React does not
 * document their relative DOM order. The chip takes CSS's default 0, so
 * anything the chrome adds later sorts above the controls, whose position users
 * learn.
 */
export const BOTTOM_RIGHT_CONTROLS_ORDER = 1
