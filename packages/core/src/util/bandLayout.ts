import { boundBandHeight } from './bandHeight.ts'

import type { BandBounds } from './bandHeight.ts'

/**
 * #api core/util
 * One band of a display's vertical stack — a coverage histogram, an arc strip,
 * a conservation row, a variant lane. The contract is the pair: `active` is
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
   * Present ⇒ `height` is bound at read time ({@link boundBandHeight}), for a
   * band whose stored value may be stale or hand-edited. Absent ⇒ the stated
   * height is trusted as-is; the setters are the only gate.
   */
  bounds?: BandBounds
}

/**
 * #api core/util
 * The pixels a band takes from the plot below it: 0 when off, the (optionally
 * bound) stated height when on. This is the single spelling of "off spends
 * 0 px".
 */
export function reservedPx(band: Band): number {
  if (!band.active) {
    return 0
  }
  return band.bounds ? boundBandHeight(band.height, band.bounds) : band.height
}

/** What {@link stackBands} derives: one top per band, and where the stack ends. */
export interface BandStack<K extends string> {
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
 * argument, so a display states its band order exactly once; reserve, paint
 * and pick all read the same fold, which is what keeps "the reserver and the
 * painter read one function" true by construction rather than by prose.
 *
 * Only the fold is shared. What varies per display stays there: per-lane
 * iteration runs this once per lane, sticky-vs-scrolling is a property of how
 * the result is projected to the screen, and a band drawn outside its
 * reservation (an overlay) carries its own draw rect beside the stack.
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
  return { top, reserved, bottom: y }
}
