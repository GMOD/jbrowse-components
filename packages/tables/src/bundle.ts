import './hostGlobals.ts'

import { alignmentColors, createTablesEngine } from './index.ts'

// The bundle's interface to a bare host: `jbrowse.<table>(argsJson)` resolves
// to the tables as JSON, typed arrays written as plain arrays.

function plain(value: unknown): unknown {
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>)
  }
  if (Array.isArray(value)) {
    return value.map(plain)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, plain(v)]),
    )
  }
  return value
}

const engine = createTablesEngine()

;(globalThis as Record<string, unknown>).jbrowse = {
  alignments: async (args: string) =>
    JSON.stringify(plain(await engine.alignments(JSON.parse(args)))),
  alignmentColors: () => JSON.stringify(alignmentColors()),
}
