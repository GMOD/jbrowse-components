# Jest Configuration

## Console warning filters

`console.js` filters expected warnings at test startup to keep test output clean. Warnings are filtered *globally* rather than per-test because the jest wrapper captures `originalWarn` in a closure — per-test `jest.spyOn(console, 'warn')` spies cannot intercept warnings that bypass through the captured reference.

To silence an expected warning: add a string check to the `console.warn` filter in `console.js` (e.g. `r.includes('your warning text')`). Document in the code why it's expected (e.g., "ldToIndex.test.ts: index SNP not found is the expected test case").
