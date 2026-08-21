// The 'auto' thin-fade decision, as a pure function of the one measurement the
// displays supply. A leaf module so the hysteresis is testable without standing
// up a view: `LinearSyntenyView.fadeThinAlignments` reads it and
// `installAutoFadeLatch` moves the latch by it, and the two must agree.

// Fade on when the narrowest display's mean on-screen alignment-block width is
// below this many pixels — i.e. thin ribbons dominate, which is precisely when
// width-proportional fade declutters. Matches the perpW < 1 sub-pixel boundary
// the renderer fades at.
const ENGAGE_PX = 1

// ...and the width the ribbons have to come back above before the fade lets go.
//
// A DEADBAND, not a second opinion: the mean is taken over whatever features the
// current fetch window holds, and that window is snapped, so it rolls over once
// per `syntenyPanBufferPx` of panning and the mean steps with the slice it
// swapped. On one threshold a view whose mean sits near 1px flips the fade —
// every sub-pixel ribbon between full alpha and WIDTH_FADE_FLOOR, view-wide —
// several times per chromosome of scrolling, which reads as the picture changing
// under the reader. Measured on peach_grape.paf at the zoom that sits on the
// threshold, a rollover steps the mean by at most 11.3%, so 25% clears it with
// room to spare and still lets a genuine zoom-in relax the fade.
const RELEASE_PX = 1.25

// ...and only once a display has at least this many blocks, so a lone thin
// ribbon in a sparse view keeps full alpha instead of being faded toward
// invisibility.
export const FADE_AUTO_MIN_FEATURES = 10

/**
 * Whether 'auto' fades, given the narrowest mean block width any loaded display
 * reports and whether the fade is latched on. `Infinity` — a view with nothing
 * thin enough to judge — never fades.
 */
export function fadesThinAt(meanPx: number, latched: boolean) {
  return meanPx < (latched ? RELEASE_PX : ENGAGE_PX)
}
