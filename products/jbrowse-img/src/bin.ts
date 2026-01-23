#!/usr/bin/env node

// Mock css imports to avoid @mui/x-data-grid importing css
// @ts-ignore - registerHooks is not typed in @types/node yet
const { registerHooks } = await import('node:module')
registerHooks({
  load(
    url: string,
    context: { format?: string },
    nextLoad: (url: string, context: { format?: string }) => unknown,
  ) {
    return url.endsWith('.css')
      ? { url, format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context)
  },
})

await import('./index.js')

// eslint-disable-next-line unicorn/require-module-specifiers
export {}
