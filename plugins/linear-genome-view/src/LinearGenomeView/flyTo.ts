import { clamp } from '@jbrowse/core/util'

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

// Van Wijk & Nuij's rho: how much the path is willing to zoom out to cover
// distance. sqrt(2) is their measured optimum and d3-interpolateZoom's default.
// Lower flattens the arc into a pan, higher pulls further back and travels
// faster, and it is the one knob here worth turning if the zoomed-out apex ever
// proves too expensive to fetch through.
const RHO = Math.sqrt(2)

// The path length `S` comes out in Van Wijk's dimensionless units of perceived
// motion, and it grows with the LOG of the distance: half a screen scores 0.7,
// one screen 1.2, a hundred screens 7.5, a whole genome 12. So the three
// numbers below are a floor for the hops too short to need time, a ceiling for
// the cross-genome one — whose honest duration is ten seconds, which is a wait
// rather than a transition — and a rate that puts everything between them on a
// curve that is nearly flat where the distances are ordinary. Perceived
// velocity is constant WITHIN a flight either way; this only picks its total.
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
 * Van Wijk & Nuij (2003), "Smooth and efficient zooming and panning" — the same
 * solution d3's `interpolateZoom` implements. It zooms out as it travels and
 * back in as it arrives, along the path that holds the *perceived* velocity
 * constant, so the reader can follow the whole journey rather than watching one
 * blurred smear.
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

// The general solution. `u` runs along the path in world units from the start,
// and the two `r` are where the start and end sit on the hyperbolic the path
// traces.
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
  // asinh(-b) rather than the paper's log(-b + sqrt(b*b + 1)) it expands to:
  // the two terms cancel to seven digits at the far end of a cross-genome jump,
  // where b runs to a thousand, and asinh is the form that does not lose them.
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

// The degenerate arm: the endpoints are the same place at different scales, so
// there is no path to trace and the zoom is exponential in `s` on its own.
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
