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
  alignments: async (args: string) =>
    send(await engine.alignments(JSON.parse(args))),
  features: async (args: string) =>
    send(await engine.features(JSON.parse(args))),
  wiggle: async (args: string) => send(await engine.wiggle(JSON.parse(args))),
  variants: async (args: string) =>
    send(await engine.variants(JSON.parse(args))),
  variantDensityAlpha: async (args: string) =>
    send(engine.variantDensityAlpha(JSON.parse(args))),
  alignmentMarkAlpha: async (args: string) =>
    send(engine.alignmentMarkAlpha(JSON.parse(args))),
  synteny: async (args: string) => send(await engine.synteny(JSON.parse(args))),
  dotplot: async (args: string) => send(await engine.dotplot(JSON.parse(args))),
  contigs: async (args: string) => send(await engine.contigs(JSON.parse(args))),
  multiway: async (args: string) =>
    send(await engine.multiway(JSON.parse(args))),
  sequence: async (args: string) => engine.sequence(JSON.parse(args)),
  fileRegions: async (args: string) =>
    send(await engine.fileRegions(JSON.parse(args))),
  regions: async (args: string) => send(await engine.regions(JSON.parse(args))),
  canonicalNames: async (args: string) =>
    send(await engine.canonicalNames(JSON.parse(args))),
  alignmentColors: () => send(alignmentColors()),
  cache: async (args: string) =>
    JSON.stringify(await engine.cache(cacheArgs(JSON.parse(args)))),
  clearCache: async () => JSON.stringify(await engine.clearCache()),
}
