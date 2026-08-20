// The two widths the 'auto' thin-fade decision is made against.
//
// A leaf module because both the display (which measures) and the view (which
// latches) need them, and the display model already imports the view's type:
// putting them in either model would close that into a cycle, which MST model
// types do not survive.

// Fade on when the mean on-screen alignment-block width is below this many
// pixels — i.e. thin ribbons dominate, which is precisely when
// width-proportional fade declutters. Matches the perpW < 1 sub-pixel boundary
// the renderer fades at.
export const FADE_AUTO_ENGAGE_PX = 1

// ...and the width it has to come back above before the fade lets go again.
//
// A DEADBAND, not a second opinion: the mean is taken over whatever features the
// current fetch window holds, and that window is snapped, so it rolls over
// roughly every half-viewport of panning and the mean steps with it. On one
// threshold, a view whose mean sits near 1px flips the fade — every sub-pixel
// ribbon between full alpha and WIDTH_FADE_FLOOR, view-wide — every few hundred
// pixels of scrolling, which reads as the picture changing under the reader.
// 25% is wider than the step a rollover makes on real data and narrow enough
// that the fade still relaxes on a genuine zoom-in.
export const FADE_AUTO_RELEASE_PX = 1.25

// ...and only once there are at least this many blocks, so a lone thin ribbon in
// a sparse view keeps full alpha instead of being faded toward invisibility.
export const FADE_AUTO_MIN_FEATURES = 10
