// testing-library's `findBy*`/`waitFor` timeout is its own setting, not jest's
// `testTimeout` — it defaults to 1000ms however long the test is allowed to run.
//
// That default measures the machine, not the code. A `findByText` waiting on a
// mocked fetch plus a render resolves in tens of ms on an idle box and blows
// past a second on a loaded one, so the suites that build a full session failed
// only when the whole repo ran at once and passed on their own. Raising it
// costs a passing test nothing — `findBy*` polls and returns on the first match,
// so the timeout bounds the failing case alone.
//
// 5s and not more: `testTimeout` is 15s, and a test that genuinely cannot find
// its element should report that rather than being cut off by the outer timeout
// with a less useful message.
const { configure } = require('@testing-library/dom')

configure({ asyncUtilTimeout: 5000 })
