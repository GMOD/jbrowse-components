import './hostGlobals.ts'

import { alignmentColors, createTablesEngine } from './index.ts'
import { toWire } from './wire.ts'

// The bundle's interface to a bare host: `jbrowse.<table>(argsJson)` resolves
// to the tables' JSON as `toWire` writes it, and leaves their bytes in
// `jbrowseBytes`, a Uint8Array, until the next call. JSON has no Infinity, so
// a cache limit of null means none, both ways.

const send = (value: unknown) => {
  const { json, bytes } = toWire(value)
  ;(globalThis as Record<string, unknown>).jbrowseBytes = bytes
  return json
}

const engine = createTablesEngine()

const cacheArgs = ({ limit }: { limit?: number | null }) =>
  limit === undefined ? {} : { limit: limit ?? Infinity }

;(globalThis as Record<string, unknown>).jbrowse = {
  ...Object.fromEntries(
    Object.entries(engine).map(([name, table]) => [
      name,
      async (args: string) =>
        send(await (table as (args: unknown) => unknown)(JSON.parse(args))),
    ]),
  ),
  sequence: async (args: string) => engine.sequence(JSON.parse(args)),
  alignmentColors: () => send(alignmentColors()),
  cache: async (args: string) =>
    JSON.stringify(await engine.cache(cacheArgs(JSON.parse(args)))),
  clearCache: async () => JSON.stringify(await engine.clearCache()),
}
