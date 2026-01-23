#!/usr/bin/env node

// Mock css imports to avoid @mui/x-data-grid importing css
// @ts-ignore - registerHooks is not typed in @types/node yet
const { registerHooks } = await import('node:module')
registerHooks({
  load(
    url: string,
    context: { format?: string },
    nextLoad: (url: string, context: { format?: string }) => void,
  ) {
    if (url.endsWith('.css')) {
      return { url, format: 'module', source: '', shortCircuit: true }
    } else {
      return nextLoad(url, context)
    }
  },
})
// Now load the main entry point
await import('./index.js')
export {}
