// useLocalStorage runs for real in tests rather than being branched off inside
// the hooks, so every test needs a clean store: jsdom keeps one localStorage per
// test *file*, and a remembered assembly or recent-location list written by one
// test would otherwise decide what the next one renders. Suites that seed a
// preference still clear it themselves — that reads as part of the test, and
// their own beforeEach runs after this one.
//
// Guarded because the default project also holds suites that opt into the node
// environment with a `@jest-environment node` docblock, and those have no
// localStorage at all.
if (typeof localStorage !== 'undefined') {
  beforeEach(() => {
    localStorage.clear()
  })
}
