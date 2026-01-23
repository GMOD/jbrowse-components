#!/usr/bin/env node

/**
 * CSS import interception for Node.js
 * This file must be loaded before any other imports to intercept CSS files
 */

// Make this file an ESM module
export {}

// ESM approach using registerHooks (Node.js 20+)
// @ts-ignore - registerHooks is not typed in @types/node yet
const { registerHooks } = await import('node:module')
// @ts-ignore
registerHooks({
  load(url: string, context: { format?: string }, nextLoad: Function) {
    if (url.endsWith('.css')) {
      return { url, format: 'module', source: '', shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})
// Now load the main entry point
await import('./index.js')
