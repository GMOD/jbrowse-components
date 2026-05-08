# jbrowse-cli CLAUDE.md

## Always use cliFetch, not global fetch

All modules in `src/` must import and use `cliFetch` instead of the global
`fetch` function. This allows tests to mock API calls via Jest's
`jest.mock('../cliFetch')`. If a module uses global `fetch`, test mocks won't
intercept those calls and tests will hit the real API instead.

Example:

```typescript
import fetch from './cliFetch.ts' // ✓ Correct
// const response = await fetch(url)  // ✗ Wrong - uses global fetch
```

This applies to all files including utils, commands, types, and helpers.
