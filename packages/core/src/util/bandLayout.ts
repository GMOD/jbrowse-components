import { boundBandHeight } from './bandHeight.ts'

import type { BandBounds } from './bandHeight.ts'

/**
 * #api core/util
 * One band of a display's vertical stack — a coverage histogram, an arc strip,
 * a conservation row. The contract is the pair: `active` is
 * whether the band exists right now (the display pre-ANDs its settings half,
 * `showX`, with its data half, "some lane has ink"), and `height` is the stated
 * height when it does. Consumers read pixels through {@link reservedPx} or
 * {@link stackBands}, never by re-combining the pair — the re-combination is
 * where the reserver and the painter historically drifted.
 */
export interface Band {
  active: boolean
  /** The stated height in px, meaningful only while `active`. */
  height: number
  /**
   * @deprecated bound a stack's stated heights with {@link boundStackedBands}
   * before folding them; a per-band bound cannot see the bands beside it.
   * Still honored by {@link reservedPx}.
   */
  bounds?: BandBounds
}

/**
 * #api core/util
 * The pixels a band takes from the plot below it: 0 when off, the stated
 * height when on. This is the single spelling of "off spends 0 px".
 */
export function reservedPx(band: Band): number {
  if (!band.active) {
    return 0
  }
  return band.bounds ? boundBandHeight(band.height, band.bounds) : band.height
}

/** What {@link stackBands} derives: one top per band, and where the stack ends. */
export interface BandStack<K extends string> {
  /** The bands, top to bottom. */
  order: readonly K[]
  /** Content-space y where each band begins, in stack order. */
  top: Record<K, number>
  /** Each band's {@link reservedPx}. */
  reserved: Record<K, number>
  /** Where the content below the stack begins — the sum of every reserved px. */
  bottom: number
}

/**
 * #api core/util
 * Fold an ordered set of bands into tops and a bottom. The order is the
 * argument, so a display states its band order exactly once. Reserve, paint
 * and pick all call this function, so the reserved and painted positions
 * cannot disagree.
 *
 * Only the fold is shared; the rest stays in each display. Per-lane
 * iteration runs this once per lane, sticky-vs-scrolling is a property of how
 * the result is projected to the screen, and a band drawn outside its
 * reservation (an overlay) has a separate draw rect beside the stack.
 */
export function stackBands<K extends string>(
  order: readonly K[],
  bands: Record<K, Band>,
): BandStack<K> {
  const top = {} as Record<K, number>
  const reserved = {} as Record<K, number>
  let y = 0
  for (const key of order) {
    top[key] = y
    reserved[key] = reservedPx(bands[key])
    y += reserved[key]
  }
  return { order, top, reserved, bottom: y }
}

/**
 * #api core/util
 * The band under content-space `y`, or undefined below the stack or over a
 * band that reserves nothing. The pointer's half of the fold: a band's hover
 * reads the same tops and heights its painter drew at.
 */
export function bandAt<K extends string>(stack: BandStack<K>, y: number) {
  return stack.order.find(
    key => y >= stack.top[key] && y < stack.top[key] + stack.reserved[key],
  )
}

/**
 * #api core/util
 * The plot a stack of bands is taken from: the px the bands and the plot
 * share, and the px the plot keeps under any stack — `MIN_BAND_HEIGHT`
 * while it draws, so its rows stay visible and the lowest band's handle stays
 * on the display, and 0 while it draws nothing.
 */
export interface BandPlot {
  height: number
  floor: number
}

function stackRoom(plot: BandPlot) {
  return Math.max(0, plot.height - plot.floor)
}

/**
 * #api core/util
 * A stack's stated heights — a config value, a session snapshot, a drag made
 * on a taller track — bound against the plot the bands share, top-down: each
 * active band takes at most the room the active bands above it left, from 0
 * px up, so the stack never takes the plot below its floor. An inactive band
 * reserves nothing, so it is bound to the whole room and comes back at a
 * legal height. Bind here, then fold with {@link stackBands}.
 */
export function boundStackedBands<K extends string>(
  order: readonly K[],
  bands: Record<K, Band>,
  plot: BandPlot,
) {
  const room = stackRoom(plot)
  const bound = {} as Record<K, Band>
  let taken = 0
  for (const key of order) {
    const band = bands[key]
    const height = boundBandHeight(band.height, {
      min: 0,
      max: band.active ? room - taken : room,
    })
    bound[key] = { active: band.active, height }
    taken += reservedPx(bound[key])
  }
  return bound
}

/**
 * #api core/util
 * The legal range for a drag of band `key` in a stack folded from
 * {@link boundStackedBands}: up to the room the plot leaves less every other
 * band's reserved px, so a drag stops where the stack meets the plot's floor
 * and never writes a height the read-time bound would cut. Pass it to
 * {@link clampBandHeight}, whose floor it leaves at the default.
 */
export function bandDragBounds<K extends string>(
  stack: BandStack<K>,
  key: K,
  plot: BandPlot,
): BandBounds {
  return {
    max: Math.max(0, stackRoom(plot) - (stack.bottom - stack.reserved[key])),
  }
}
