// A region with data but no scores (empty / not covered by the file) has no
// score range to autoscale, yet it must still render — `renderBlocks` has to run
// to clear the canvas and flip `canvasDrawn`, or the display spins on the
// loading overlay forever. The GPU render-state can't be *built* without a
// domain (it encodes one for vertical scaling), so this stands in. It's inert:
// nothing is ever plotted against it (there's no data), and every axis/legend a
// caller draws is gated on the *real* `domain`, so it never surfaces as a fake
// scale. The specific numbers are irrelevant — [0,1] is just a valid range.
const EMPTY_PLOT_DOMAIN: [number, number] = [0, 1]

// The render-state a wiggle-family GPU display builds from its score `domain`,
// always resolvable (real domain, else EMPTY_PLOT_DOMAIN). This is NOT the
// loading gate — "no fetch has completed yet" is the caller's
// `rpcDataMap.size === 0` check in its render callback (the same first-paint gate
// every GPU display uses), not a nullable render state. `build` absorbs each
// display's render-state shape (wiggle's encoded WiggleGPURenderState vs
// manhattan's { domainY, canvasWidth, canvasHeight }), so only the empty-plot
// domain is shared, not the construction.
export function resolveRenderState<T>(
  domain: [number, number] | undefined,
  build: (domain: [number, number]) => T,
): T {
  return build(domain ? domain : EMPTY_PLOT_DOMAIN)
}
