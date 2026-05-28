// The three-way render-state decision every wiggle-family GPU display makes
// from its score `domain`. Centralized so the (subtle) loading-vs-clear
// invariant lives in one place instead of being copy-pasted per display:
//
//   - domain present       → build the real render state
//   - no domain, no data    → undefined: no fetch has completed, so keep the
//                             loading overlay up
//   - no domain, has data   → build a stub ([0,1] domain) so renderBlocks still
//                             runs, clears the canvas, and flips canvasDrawn
//                             (the fetch completed but returned zero features)
//
// `build` absorbs each display's render-state shape — wiggle's encoded
// WiggleGPURenderState vs manhattan's { domainY, canvasWidth, canvasHeight } —
// so only the decision is shared, not the construction.
export function resolveRenderState<T>(
  domain: [number, number] | undefined,
  hasData: boolean,
  build: (domain: [number, number]) => T,
): T | undefined {
  return domain ? build(domain) : hasData ? build([0, 1]) : undefined
}
