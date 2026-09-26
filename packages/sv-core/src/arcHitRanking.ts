/**
 * How far outside its own stroke an arc still answers a hover, in CSS px.
 *
 * An arc is ink one to a few px wide over a band tens of px tall, so requiring
 * the cursor to be within the stroke itself makes the target a hairline and the
 * tooltip a thing you fish for. Callers add it to each mark's own half-width, so
 * a thicker arc grows its target the way it grows its ink, rather than every arc
 * getting one fixed-size hitbox.
 */
export const ARC_HIT_SLOP_PX = 3
