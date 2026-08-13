// What React's dev-mode render-logging actually did, recorded by
// enableReactRenderLogging's performance.measure wrapper.
//
// Separate from that module on purpose. Its import has to be the FIRST one in
// a test file — it supplies a gate react-dom reads once at module scope — and
// the only import form the sorter is guaranteed to leave in place is a
// side-effect import, which cannot also bind a name. So the installer stays
// side-effect-only and the reader lives here, where its position is nobody's
// problem.

const measured: string[] = []

// React prefixes each render-logging measure with a zero-width space, so the
// entry renders unprefixed in the performance panel.
const RENDER_LOG_PREFIX = '\u200B'

export function recordMeasure(name: string) {
  measured.push(name)
}

/**
 * The names of the components React ran its render-logging on, in order.
 *
 * performance.measure is reached from one branch of logComponentRender only —
 * the one that runs addObjectDiffToProperties over a component whose props
 * changed — so a non-empty result is proof that the props walk happened.
 *
 * Assert on this in any test that relies on that walk. Without it, anything
 * that stops the gate being satisfied (React adding a condition, the import
 * sorter moving the installer below react-dom — which has happened) turns the
 * test back into the no-op the whole suite was before: still green, still
 * passing, no longer testing anything.
 */
export function renderLoggedComponents() {
  return measured
    .filter(name => name.startsWith(RENDER_LOG_PREFIX))
    .map(name => name.slice(RENDER_LOG_PREFIX.length))
}
