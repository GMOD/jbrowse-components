declare global {
  interface ErrorConstructor {
    // a V8 extension, so it isn't in the DOM lib. @types/node declares it too
    // and only leaks in here transitively via @types/jest, so declare it
    // ourselves rather than lean on that; the shape must stay identical to
    // node's or the two declarations conflict
    stackTraceLimit: number
  }
}

// V8 records only the top 10 frames of any Error by default, and the RPC,
// React and MST plumbing can consume all 10 before reaching JBrowse code —
// truncating bug reports right above the actual fault. 50 gets through the
// wrappers. Costs ~34µs extra per Error constructed, which is irrelevant here:
// JBrowse throws exceptionally, not as control flow (MST's typecheck failures
// are plain objects, not Errors).
//
// Only *applications* should call this. It mutates a global, so the embeddable
// products (@jbrowse/react-app, react-linear-genome-view, ...) must not impose
// it on their host page. Worker entry points are fair game: that scope is ours,
// and a worker error's stack is captured in the worker, so the limit has to be
// raised there to have any effect on it.
//
// No-op outside V8 — firefox and safari have no equivalent knob and ignore the
// assignment.
export function setStackTraceLimit() {
  // setting this V8-only property is the entire point; engines without it ignore it
  // eslint-disable-next-line unicorn/no-nonstandard-builtin-properties
  Error.stackTraceLimit = 50
}
