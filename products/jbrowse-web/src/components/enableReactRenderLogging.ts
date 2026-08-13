// React 19's dev-mode component-render logging (logComponentRender ->
// addObjectDiffToProperties, which walks into each component's props and reads
// every property of every object it finds) is gated at react-dom module scope
// on
//
//   typeof console.timeStamp === 'function' &&
//   typeof performance.measure === 'function'
//
// jsdom supplies neither, so that logging never runs under jest. It is the
// first thing a developer sees in a browser and is structurally invisible to
// the whole suite — which is why a crash it caused reached a user with every
// test green. Stubbing both halves of the gate makes it run.
//
// Import this BEFORE anything that pulls in react-dom: the gate is a module
// scope constant, read once when react-dom is first evaluated.
if (typeof console.timeStamp !== 'function') {
  console.timeStamp = () => {}
}
if (typeof performance.measure !== 'function') {
  // @ts-expect-error stubbing the jsdom gap
  performance.measure = () => {}
}
if (typeof performance.mark !== 'function') {
  // @ts-expect-error stubbing the jsdom gap
  performance.mark = () => {}
}

export {}
