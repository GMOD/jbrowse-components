import { recordMeasure } from './renderLogRecord.ts'

// React 19's dev-mode component-render logging (logComponentRender ->
// addObjectDiffToProperties, which walks into each component's props and reads
// every property of every object it finds, four levels deep) is gated at
// react-dom module scope on
//
//   typeof console.timeStamp === 'function' &&
//   typeof performance.measure === 'function'
//
// jsdom supplies neither, so that logging never runs under jest. It is the
// first thing a developer sees in a browser and is structurally invisible to
// the whole suite — which is why a crash it caused reached a user with every
// test green. Supplying both halves of the gate makes it run.
//
// Import this BEFORE anything that pulls in react-dom — the gate is a module
// scope constant, read once when react-dom is first evaluated — and import it
// for its side effect only, so the sorter leaves it where you put it. Read
// what it recorded from renderLogRecord.ts, and assert on that: a test that
// silently stops satisfying the gate is a test that silently stops testing.

// wrap rather than replace, so this keeps working if jsdom ever grows real
// implementations and the gate stops needing help
const realMeasure = globalThis.performance.measure as unknown
// eslint-disable-next-line no-console
const realTimeStamp = console.timeStamp as unknown

// eslint-disable-next-line no-console
console.timeStamp =
  typeof realTimeStamp === 'function'
    ? (realTimeStamp.bind(console) as typeof console.timeStamp)
    : () => {}

globalThis.performance.measure = ((name: string, ...rest: unknown[]) => {
  recordMeasure(name)
  return typeof realMeasure === 'function'
    ? (realMeasure as (...a: unknown[]) => unknown).call(
        globalThis.performance,
        name,
        ...rest,
      )
    : undefined
}) as typeof performance.measure

if (typeof globalThis.performance.mark !== 'function') {
  // @ts-expect-error stubbing the jsdom gap
  globalThis.performance.mark = () => {}
}
