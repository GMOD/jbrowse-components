// Fails the test that printed to the console. A test's output is either
// expected, and then the test spies on the console and asserts the message,
// or it is a stub, fixture or code path going wrong: four of the eleven suites
// that printed when this went in were the second kind, and every one of them
// was green. `console.js` keeps the run-wide filters and records what gets past
// them; this reads that record after each test and after the file.
//
// `jest.spyOn(console, 'warn').mockImplementation(() => {})` replaces the
// recorder, so a test that asserts on its own output is out of the gate by
// construction. Output landing after a test's body returned (a debounced
// autorun, a late promise) is charged to the next test, or to the file.
function failOn(when) {
  const taken = globalThis.takePrintedConsole()
  if (taken.length > 0) {
    throw new Error(
      `the console was written ${when}:\n\n${taken.map(t => `  ${t}`).join('\n')}\n\n` +
        'If the output is expected, spy on the console in the test and assert ' +
        'the message; otherwise fix the stub, fixture or code that printed it.',
    )
  }
}

afterEach(() => {
  failOn('while this test ran')
})
afterAll(() => {
  failOn('outside any test')
})
