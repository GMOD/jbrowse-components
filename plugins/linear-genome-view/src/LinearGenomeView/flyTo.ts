import { clamp } from '@jbrowse/core/util'

// The zoom-and-pan path below is Van Wijk & Nuij's, not ours:
//
//   Jarke J. van Wijk and Wim A. A. Nuij, "Smooth and efficient zooming and
//   panning", Proc. IEEE Symposium on Information Visualization (InfoVis)
//   2003, Seattle WA, pp. 15-22. doi:10.1109/INFVIS.2003.1249004
//   https://vanwijk.win.tue.nl/zoompan.pdf
//
// `zoomAndPan` is their equation (9) — section 5, "The optimal path" — in the
// paper's own notation, so the two can be read against each other: u is the
// distance travelled along the path, w the width of the window, rho the
// zoom/pan trade-off, s the arc length and S its total. `zoomInPlace` is the
// u0 = u1 case they give immediately after it. Equation (9) is a geodesic
// under their metric, which is what makes it the shortest path whose PERCEIVED
// rate of change is constant; that property is the whole reason to use it here
// rather than to interpolate.
//
// Written from the paper rather than ported. The same algorithm is
// d3-interpolate's `interpolateZoom` (Mike Bostock, ISC):
// https://github.com/d3/d3-interpolate/blob/main/src/zoom.js
//
// Two deliberate departures from the published form, both noted where they
// happen: `Math.asinh` in place of the logarithm (9) writes r_i as, and a
// duration that is nothing like the paper's. `springAnimate` is the tree's
// other animation primitive and cites its source the same way.

/**
 * A window of the view's linearized bp space — the space `windowStartBp` is in,
 * so a position here is invariant under zoom and a flight can be planned once
 * for a path whose scale changes under it.
 */
export interface FlightViewport {
  centerBp: number
  windowWidthBp: number
}

export interface Flight {
  durationMs: number
  /** the viewport at `t` in [0,1]; exactly the destination at t >= 1 */
  at: (t: number) => FlightViewport
}

// The paper's rho: how much the path is willing to zoom out to cover distance.
// Their section 6 user experiment measured 1.42 (sd 0.47), and they note that
// it "suggests that rho = sqrt(2) is possibly an optimal value" without being
// able to say why; d3-interpolateZoom takes the same sqrt(2). Lower flattens
// the arc into a pan, higher pulls further back and travels faster, and it is
// the one knob here worth turning if the zoomed-out apex proves too expensive
// to fetch through.
//
// WHICH IS NOT A HYPOTHETICAL, and is the known open cost of this. A
// cross-chromosome flight over stacked whole assemblies traces roughly 15
// octaves of zoom out and 15 back, and synteny's fetch key buckets on
// `floor(log2(bpPerPx))` — so a flight crosses ~30 fetch buckets where a drag
// at constant zoom crosses none. The 500ms leading-edge debounce turns that
// into a handful of RPCs per flight rather than 30, but they are RPCs for
// windows nobody stops to look at. Unmeasured on a real file; a gate on
// synteny's existing `fetchInert` is the obvious lever if it bites, and
// lowering rho is the one that costs no coupling.
const RHO = Math.sqrt(2)

// WHERE WE PART COMPANY WITH THE PAPER, and the one number in here that is not
// theirs. `S` is a path length in their dimensionless units of perceived
// motion, growing with the LOG of the distance: half a screen scores 0.7, one
// screen 1.2, a hundred screens 7.5, a whole genome 12. Their section 6
// measured an animation speed V of 0.90 of those units per second, which would
// put that whole-genome flight at THIRTEEN SECONDS — a wait, not a transition,
// and their own scenario (a map of the US) never asks for a path that long.
//
// So the duration is clamped instead: a floor for the hops too short to need
// time, a ceiling for the cross-genome one, and a rate between. At the ceiling
// that is an effective V around 11, an order of magnitude above what they
// measured, and it is the deliberate cost of not making the reader wait.
// Perceived velocity is still constant WITHIN a flight — that is equation (9)'s
// doing, not this — and this only picks the total.
const MS_PER_UNIT = 90
const MIN_MS = 250
const MAX_MS = 1100

// Below this much motion, relative to the window it happens in, the pan is
// treated as none at all. RELATIVE, not absolute: the general solution divides
// by the distance, so a sub-bp move between two different zooms sends `b`
// through infinity and `at` returns NaN — and an absolute epsilon that is small
// against a 250Mb chromosome is not small against a 500bp window.
const STATIONARY = 1e-6

/**
 * The viewport path from `from` to `to`, and how long to spend on it.
 *
 * The path is equation (9) of the paper cited at the top of this file: it zooms
 * out as it travels and back in as it arrives, along the geodesic that holds
 * the *perceived* velocity constant, so the reader can follow the whole journey
 * rather than watching one blurred smear.
 *
 * A STRAIGHT PAN IS NOT THE ALTERNATIVE, it is the thing this exists to avoid.
 * The jump that wants animating here is a synteny row showing a whole assembly
 * being sent to a mate on another chromosome: tens of megabases at a window of
 * tens of kilobases, which is a thousand screens of travel. Panned at constant
 * scale that is a thousand screens of unreadable streaking and no frame in
 * which the reader is anywhere identifiable. Pulled back to where both ends fit
 * and then dropped in, it is a picture of where they came from and where they
 * landed.
 *
 * The zoomed-out apex is `w0 * cosh(r0)` — for a same-zoom hop, about the
 * distance travelled — so the arc naturally tops out at "both endpoints on
 * screen". A view whose `maxBpPerPx` is tighter than that simply clamps there
 * and flies the middle of the path flat; nothing here has to know the limit,
 * because the caller writes through `zoomTo` and reads back what it got.
 */
export function planFlight(from: FlightViewport, to: FlightViewport): Flight {
  const w0 = from.windowWidthBp
  const w1 = to.windowWidthBp
  const delta = to.centerBp - from.centerBp
  const dist = Math.abs(delta)
  const at =
    dist > Math.max(w0, w1) * STATIONARY
      ? zoomAndPan(from, to, dist, Math.sign(delta))
      : zoomInPlace(from, to)
  return {
    durationMs: at ? clamp(at.S * MS_PER_UNIT, MIN_MS, MAX_MS) : 0,
    // Snapped at the end rather than left to the closed form, whose `u(S)`
    // reaches the destination only to within the rounding of two hyperbolics.
    at: t => (at && t < 1 ? at.at(t) : to),
  }
}

// Equation (9), term for term. `u` runs along the path in world units from the
// start, and the two `r` are where the start and end sit on the ellipse the
// path traces. The paper's `u1 - u0` is signed; here the caller's sign is
// carried separately in `direction` and `dist` is its magnitude, so that u0 = 0
// and the two forms agree.
function zoomAndPan(
  from: FlightViewport,
  to: FlightViewport,
  dist: number,
  direction: number,
) {
  const w0 = from.windowWidthBp
  const w1 = to.windowWidthBp
  const rho2 = RHO * RHO
  const rho4 = rho2 * rho2
  const b0 = (w1 * w1 - w0 * w0 + rho4 * dist * dist) / (2 * w0 * rho2 * dist)
  const b1 = (w1 * w1 - w0 * w0 - rho4 * dist * dist) / (2 * w1 * rho2 * dist)
  // asinh(-b), which is exactly the ln(-b + sqrt(b*b + 1)) equation (9) writes
  // (and d3 implements literally) — but evaluated without the catastrophic
  // cancellation those two terms suffer at the far end of a cross-genome jump,
  // where b runs to a thousand and they agree to seven digits before
  // subtracting. Same value, better conditioned.
  const r0 = Math.asinh(-b0)
  const r1 = Math.asinh(-b1)
  const S = (r1 - r0) / RHO
  const coshR0 = Math.cosh(r0)
  const sinhR0 = Math.sinh(r0)
  return S > 0
    ? {
        S,
        at: (t: number) => {
          const s = t * S * RHO + r0
          return {
            centerBp:
              from.centerBp +
              direction *
                ((w0 / rho2) * coshR0 * Math.tanh(s) - (w0 / rho2) * sinhR0),
            windowWidthBp: (w0 * coshR0) / Math.cosh(s),
          }
        },
      }
    : undefined
}

// The paper's u0 = u1 case, given unnumbered just after equation (9): the
// endpoints are the same place at different scales, so there is no path to
// trace and the zoom is exponential in `s` on its own. Their `w0 exp(k*rho*s)`
// over `S = |ln(w1/w0)|/rho` is `w0 * ratio**t` here, which is the same curve
// with `t = s/S` and their sign `k` folded into the ratio.
function zoomInPlace(from: FlightViewport, to: FlightViewport) {
  const ratio = to.windowWidthBp / from.windowWidthBp
  const S = Math.abs(Math.log(ratio)) / RHO
  return S > 0
    ? {
        S,
        at: (t: number) => ({
          centerBp: from.centerBp + (to.centerBp - from.centerBp) * t,
          windowWidthBp: from.windowWidthBp * ratio ** t,
        }),
      }
    : undefined
}
