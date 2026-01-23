#!/usr/bin/env node

// Mock css imports to avoid @mui/x-data-grid importing css
// This MUST happen before any other imports since static imports are hoisted
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

const { main } = await import('./cli.js')

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

// eslint-disable-next-line unicorn/require-module-specifiers
export {}
