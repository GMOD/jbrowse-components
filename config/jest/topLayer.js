// jsdom implements none of the top-layer pseudo-classes, and nwsapi answers
// them by asking the element to match itself — which in jsdom lands back in
// nwsapi, so `:modal` recurses until the stack overflows, and its `|| :fullscreen`
// fallback makes that exponential. @floating-ui probes both on every reposition,
// so a suite with a live tooltip in it spends tens of seconds per re-render.
// Answering false is what the blown-up match returns anyway.
const original = Element.prototype.matches
Element.prototype.matches = function (selectors) {
  return /^:(modal|popover-open|fullscreen|picture-in-picture)$/.test(selectors)
    ? false
    : original.call(this, selectors)
}
