// The `fetchMock` global, installed by `config/jest/fetchMockAfterEnv.js`.
//
// jest-fetch-mock declares this global itself, but a `declare global` only
// applies to programs that LOAD the declaring file. The one thing loading it
// was an `import fetchMock from 'jest-fetch-mock'` in
// RemoteFileWithRangeCache.test.ts, which left for its own package with the
// code it tested (b6ed79db04) and took the declaration for eleven other files
// with it — jbrowse-web's and jbrowse-desktop's test helpers, which use the
// global rather than importing the package.
//
// Its own file rather than a line in global.d.ts, which is the shape this
// already had (8efdaea485, for the overloads that later became redundant): the
// top-level import makes this a module, and global.d.ts has to stay a pure
// ambient script or the `declare module '*.css'` in it stops being ambient.
import type { FetchMock } from 'jest-fetch-mock'

declare global {
  // `const`, not the package's `var`: nothing assigns to it, and a global
  // `var` in a .d.ts is what the no-var rule is about.
  const fetchMock: FetchMock
}
